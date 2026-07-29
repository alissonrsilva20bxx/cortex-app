-- ============================================================
-- JobApp Rede - Migration 0008: grafo social
-- ============================================================
-- Amizades sao bidirecionais e consentidas. Bloqueios sao privados:
-- somente quem bloqueou enxerga e gerencia a propria lista.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_amizade_status'
  ) then
    create type public.rede_amizade_status
      as enum ('pendente', 'aceita', 'recusada');
  end if;
end
$$;

create table if not exists public.rede_amizades (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  status public.rede_amizade_status not null default 'pendente',
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  constraint rede_amizades_usuarios_distintos
    check (solicitante_id <> destinatario_id)
);

create unique index if not exists rede_amizades_par_unico_idx
  on public.rede_amizades (
    least(solicitante_id, destinatario_id),
    greatest(solicitante_id, destinatario_id)
  );

create index if not exists rede_amizades_solicitante_idx
  on public.rede_amizades (solicitante_id);

create index if not exists rede_amizades_destinatario_idx
  on public.rede_amizades (destinatario_id);

create or replace function public.rede_validar_resposta_amizade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pendente'
    or new.status not in ('aceita', 'recusada')
    or new.respondido_em is null
  then
    raise exception 'transicao de amizade invalida'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rede_amizades_validar_resposta
  on public.rede_amizades;
create trigger rede_amizades_validar_resposta
  before update on public.rede_amizades
  for each row
  execute function public.rede_validar_resposta_amizade();

create table if not exists public.rede_bloqueios (
  id uuid primary key default gen_random_uuid(),
  bloqueador_id uuid not null references auth.users(id) on delete cascade,
  bloqueado_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint rede_bloqueios_usuarios_distintos
    check (bloqueador_id <> bloqueado_id),
  constraint rede_bloqueios_par_unico
    unique (bloqueador_id, bloqueado_id)
);

alter table public.rede_amizades enable row level security;
alter table public.rede_bloqueios enable row level security;

revoke all
  on table public.rede_amizades, public.rede_bloqueios
  from anon, authenticated, service_role;
revoke all on type public.rede_amizade_status from public;

grant usage on type public.rede_amizade_status
  to authenticated, service_role;
grant select, delete
  on table public.rede_amizades, public.rede_bloqueios
  to authenticated;
grant insert (solicitante_id, destinatario_id)
  on table public.rede_amizades
  to authenticated;
grant update (status, respondido_em)
  on table public.rede_amizades
  to authenticated;
grant insert (bloqueador_id, bloqueado_id)
  on table public.rede_bloqueios
  to authenticated;
grant select, insert, update, delete
  on table public.rede_amizades, public.rede_bloqueios
  to service_role;

drop policy if exists "rede_amizades: endpoints select"
  on public.rede_amizades;
create policy "rede_amizades: endpoints select"
  on public.rede_amizades
  for select
  to authenticated
  using (
    public.rede_is_member()
    and (
      auth.uid() = solicitante_id
      or auth.uid() = destinatario_id
    )
  );

drop policy if exists "rede_amizades: requester insert"
  on public.rede_amizades;
create policy "rede_amizades: requester insert"
  on public.rede_amizades
  for insert
  to authenticated
  with check (
    auth.uid() = solicitante_id
    and public.rede_is_member()
    and status = 'pendente'
    and respondido_em is null
  );

drop policy if exists "rede_amizades: recipient update"
  on public.rede_amizades;
create policy "rede_amizades: recipient update"
  on public.rede_amizades
  for update
  to authenticated
  using (
    auth.uid() = destinatario_id
    and public.rede_is_member()
  )
  with check (
    auth.uid() = destinatario_id
    and public.rede_is_member()
  );

drop policy if exists "rede_amizades: endpoints delete"
  on public.rede_amizades;
create policy "rede_amizades: endpoints delete"
  on public.rede_amizades
  for delete
  to authenticated
  using (
    public.rede_is_member()
    and (
      auth.uid() = solicitante_id
      or auth.uid() = destinatario_id
    )
  );

drop policy if exists "rede_bloqueios: blocker select"
  on public.rede_bloqueios;
create policy "rede_bloqueios: blocker select"
  on public.rede_bloqueios
  for select
  to authenticated
  using (
    auth.uid() = bloqueador_id
    and public.rede_is_member()
  );

drop policy if exists "rede_bloqueios: blocker insert"
  on public.rede_bloqueios;
create policy "rede_bloqueios: blocker insert"
  on public.rede_bloqueios
  for insert
  to authenticated
  with check (
    auth.uid() = bloqueador_id
    and public.rede_is_member()
  );

drop policy if exists "rede_bloqueios: blocker delete"
  on public.rede_bloqueios;
create policy "rede_bloqueios: blocker delete"
  on public.rede_bloqueios
  for delete
  to authenticated
  using (
    auth.uid() = bloqueador_id
    and public.rede_is_member()
  );
