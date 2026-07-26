-- ============================================================
-- JobApp Rede - Migration 0008: grafo social (amizades e bloqueios)
-- ============================================================
-- rede_amizades e rede_bloqueios referenciam rede_perfis(user_id), nao
-- auth.users(id) diretamente: so quem ja tem perfil (ou seja, convite
-- resgatado, ver 0006) pode aparecer nos dois lados de uma amizade ou de
-- um bloqueio.
--
-- rede_amizades: linhas visiveis/gerenciaveis só por quem aparece como
-- solicitante_id ou destinatario_id (RLS simetrica, sem checagem extra
-- de "quem pode aceitar" - essa regra de negocio fica para a camada de
-- servico, RD-12). Pedido duplicado (nos dois sentidos) e rejeitado por
-- um indice unico sobre o par nao-ordenado (least/greatest).
--
-- rede_bloqueios: só o proprio bloqueador ve/gerencia seus bloqueios -
-- o bloqueado nao tem como descobrir que foi bloqueado por aqui
-- (intencional, ver BETA_DOMAIN_MODEL.md secao 6).

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
  solicitante_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  destinatario_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  status public.rede_amizade_status not null default 'pendente',
  criado_em timestamptz not null default now(),
  respondido_em timestamptz,
  constraint rede_amizades_nao_autoamizade check (solicitante_id <> destinatario_id)
);

-- Par nao-ordenado: {A, B} so pode aparecer uma vez, nao importa quem
-- mandou o pedido primeiro nem o status atual da linha.
create unique index if not exists rede_amizades_par_unico_idx
  on public.rede_amizades (least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id));

create index if not exists rede_amizades_solicitante_idx
  on public.rede_amizades (solicitante_id);

create index if not exists rede_amizades_destinatario_idx
  on public.rede_amizades (destinatario_id);

create table if not exists public.rede_bloqueios (
  id uuid primary key default gen_random_uuid(),
  bloqueador_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  bloqueado_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint rede_bloqueios_nao_autobloqueio check (bloqueador_id <> bloqueado_id),
  constraint rede_bloqueios_par_unico unique (bloqueador_id, bloqueado_id)
);

alter table public.rede_amizades enable row level security;
alter table public.rede_bloqueios enable row level security;

-- Supabase's current default no longer auto-exposes new public objects.
-- Keep client privileges minimal; RLS remains the row-level gate.
revoke all on type public.rede_amizade_status from public;
grant usage on type public.rede_amizade_status to authenticated, service_role;
revoke all
  on table
    public.rede_amizades,
    public.rede_bloqueios
  from anon, authenticated, service_role;
grant select, insert, update, delete on table public.rede_amizades
  to authenticated;
grant select, insert, delete on table public.rede_bloqueios
  to authenticated;
grant select, insert, update, delete
  on table
    public.rede_amizades,
    public.rede_bloqueios
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_amizades'
      and policyname = 'rede_amizades: participant select'
  ) then
    create policy "rede_amizades: participant select"
      on public.rede_amizades
      for select
      to authenticated
      using (
        auth.uid() = solicitante_id
        or auth.uid() = destinatario_id
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_amizades'
      and policyname = 'rede_amizades: requester insert'
  ) then
    create policy "rede_amizades: requester insert"
      on public.rede_amizades
      for insert
      to authenticated
      with check (
        auth.uid() = solicitante_id
        and status = 'pendente'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_amizades'
      and policyname = 'rede_amizades: participant update'
  ) then
    create policy "rede_amizades: participant update"
      on public.rede_amizades
      for update
      to authenticated
      using (
        auth.uid() = solicitante_id
        or auth.uid() = destinatario_id
      )
      with check (
        auth.uid() = solicitante_id
        or auth.uid() = destinatario_id
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_amizades'
      and policyname = 'rede_amizades: participant delete'
  ) then
    create policy "rede_amizades: participant delete"
      on public.rede_amizades
      for delete
      to authenticated
      using (
        auth.uid() = solicitante_id
        or auth.uid() = destinatario_id
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_bloqueios'
      and policyname = 'rede_bloqueios: owner select'
  ) then
    create policy "rede_bloqueios: owner select"
      on public.rede_bloqueios
      for select
      to authenticated
      using (auth.uid() = bloqueador_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_bloqueios'
      and policyname = 'rede_bloqueios: owner insert'
  ) then
    create policy "rede_bloqueios: owner insert"
      on public.rede_bloqueios
      for insert
      to authenticated
      with check (auth.uid() = bloqueador_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_bloqueios'
      and policyname = 'rede_bloqueios: owner delete'
  ) then
    create policy "rede_bloqueios: owner delete"
      on public.rede_bloqueios
      for delete
      to authenticated
      using (auth.uid() = bloqueador_id);
  end if;
end
$$;
