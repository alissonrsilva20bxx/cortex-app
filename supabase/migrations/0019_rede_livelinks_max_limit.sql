-- JobApp Rede - issue #61: enforce LIVELINKS_MAX (5) in the database, not
-- just in the client (components/rede/LiveLinksSection.tsx). A direct
-- API/RPC insert bypassing the UI could otherwise create more than 5
-- LiveLinks for a user.
--
-- Trigger name is chosen to fire after rede_livelinks_lock_owner (0012) in
-- the BEFORE INSERT order -- same-timing triggers on the same table fire
-- alphabetically by name ("lock_owner" < "max_limit_check") -- so the count
-- check below only runs once the per-owner advisory lock from 0012 is
-- held, and two concurrent inserts can't both observe count = 4.

create or replace function public.rede_livelinks_max_limit_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_count integer;
begin
  select pg_catalog.count(*)
  into existing_count
  from public.rede_livelinks
  where user_id = new.user_id;

  if existing_count >= 5 then
    raise exception 'limite de 5 LiveLinks por usuario excedido'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rede_livelinks_max_limit_check
  on public.rede_livelinks;
create trigger rede_livelinks_max_limit_check
  before insert on public.rede_livelinks
  for each row execute function public.rede_livelinks_max_limit_check();

revoke all on function public.rede_livelinks_max_limit_check() from public;
