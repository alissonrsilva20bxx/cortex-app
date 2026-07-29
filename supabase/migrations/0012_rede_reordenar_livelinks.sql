-- JobApp Rede - RD-10: atomic LiveLink reordering.
--
-- The RPC owns the whole validation-and-write transaction. Serializing by
-- owner prevents two concurrent reorder requests from interleaving positions.

create or replace function public.rede_lock_livelink_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'DELETE' then
    owner_id := old.user_id;
  else
    owner_id := new.user_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(owner_id::text, 0)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists rede_livelinks_lock_owner
  on public.rede_livelinks;
create trigger rede_livelinks_lock_owner
  before insert or update or delete on public.rede_livelinks
  for each row execute function public.rede_lock_livelink_owner();

create or replace function public.rede_reordenar_livelinks(
  livelink_ids uuid[]
)
returns setof public.rede_livelinks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  owned_count integer;
begin
  if caller_id is null or not public.rede_is_member() then
    raise exception 'usuario nao autorizado a reordenar LiveLinks'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  if livelink_ids is null
    or exists (
      select 1
      from pg_catalog.unnest(livelink_ids) as requested(id)
      where requested.id is null
    )
    or pg_catalog.cardinality(livelink_ids) <> (
      select pg_catalog.count(distinct requested.id)
      from pg_catalog.unnest(livelink_ids) as requested(id)
    )
  then
    raise exception 'conjunto de LiveLinks invalido'
      using errcode = '22023';
  end if;

  select pg_catalog.count(*)
  into owned_count
  from public.rede_livelinks
  where user_id = caller_id;

  if pg_catalog.cardinality(livelink_ids) <> owned_count
    or exists (
      select 1
      from pg_catalog.unnest(livelink_ids) as requested(id)
      where not exists (
        select 1
        from public.rede_livelinks link
        where link.id = requested.id
          and link.user_id = caller_id
      )
    )
  then
    raise exception 'conjunto de LiveLinks invalido'
      using errcode = '22023';
  end if;

  update public.rede_livelinks as link
  set ordem = requested.ordem - 1
  from pg_catalog.unnest(livelink_ids)
    with ordinality as requested(id, ordem)
  where link.id = requested.id
    and link.user_id = caller_id;

  return query
  select link.*
  from public.rede_livelinks link
  where link.user_id = caller_id
  order by link.ordem, link.id;
end;
$$;

revoke all on function public.rede_reordenar_livelinks(uuid[]) from public;
revoke all on function public.rede_lock_livelink_owner() from public;
grant execute on function public.rede_reordenar_livelinks(uuid[])
  to authenticated;

comment on function public.rede_reordenar_livelinks(uuid[]) is
  'Atomically validates and reorders the authenticated owner complete LiveLink set.';
