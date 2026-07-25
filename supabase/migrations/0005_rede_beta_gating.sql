-- ============================================================
-- JobApp Rede - Migration 0005: gating do beta
-- ============================================================
-- A lista de espera e legivel/criavel somente pelo proprio usuario.
-- Convites e a allowlist de admins nao aceitam escrita pelo client.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_solicitacao_beta_status'
  ) then
    create type public.rede_solicitacao_beta_status
      as enum ('pendente', 'convidado', 'recusado');
  end if;
end
$$;

create table if not exists public.rede_solicitacoes_beta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  status public.rede_solicitacao_beta_status not null default 'pendente'
);

create table if not exists public.rede_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.rede_convites (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null unique,
  solicitacao_id uuid references public.rede_solicitacoes_beta(id)
    on delete cascade,
  usado_por uuid references auth.users(id) on delete cascade,
  usado_em timestamptz,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  constraint rede_convites_uso_consistente check (
    (usado_por is null and usado_em is null)
    or (usado_por is not null and usado_em is not null)
  )
);

create index if not exists rede_convites_usado_por_idx
  on public.rede_convites (usado_por);

create index if not exists rede_convites_solicitacao_id_idx
  on public.rede_convites (solicitacao_id);

alter table public.rede_solicitacoes_beta enable row level security;
alter table public.rede_admins enable row level security;
alter table public.rede_convites enable row level security;

-- Evita que a policy de convites dependa da policy de rede_admins.
create or replace function public.rede_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.rede_is_admin() from public;
grant execute on function public.rede_is_admin() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_solicitacoes_beta'
      and policyname = 'rede_solicitacoes_beta: owner select'
  ) then
    create policy "rede_solicitacoes_beta: owner select"
      on public.rede_solicitacoes_beta
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_solicitacoes_beta'
      and policyname = 'rede_solicitacoes_beta: owner insert pending'
  ) then
    create policy "rede_solicitacoes_beta: owner insert pending"
      on public.rede_solicitacoes_beta
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and status = 'pendente'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_admins'
      and policyname = 'rede_admins: self select'
  ) then
    create policy "rede_admins: self select"
      on public.rede_admins
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_convites'
      and policyname = 'rede_convites: redeemed owner or admin select'
  ) then
    create policy "rede_convites: redeemed owner or admin select"
      on public.rede_convites
      for select
      to authenticated
      using (
        usado_por = auth.uid()
        or public.rede_is_admin()
      );
  end if;
end
$$;
