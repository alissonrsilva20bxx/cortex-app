-- ============================================================
-- JobApp Rede - Migration 0006: perfis e LiveLinks
-- ============================================================
-- Existir em rede_perfis e o opt-in de entrar na Rede (mesmo principio de
-- push_subscriptions: a linha em si e o sinal, sem coluna de flag separada).
-- So quem tem convite resgatado (rede_convites.usado_por = auth.uid())
-- consegue criar a propria linha; qualquer membro (mesmo criterio) pode ler
-- o perfil e os LiveLinks de qualquer outro membro.

create table if not exists public.rede_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_exibicao text not null,
  bio text,
  cor_avatar text not null,
  area_atuacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists rede_perfis_updated_at on public.rede_perfis;
create trigger rede_perfis_updated_at
  before update on public.rede_perfis
  for each row execute function public.set_updated_at();

create table if not exists public.rede_livelinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  titulo text not null,
  url text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists rede_livelinks_user_ordem_idx
  on public.rede_livelinks (user_id, ordem);

alter table public.rede_perfis enable row level security;
alter table public.rede_livelinks enable row level security;

-- Evita repetir a subquery em rede_convites em toda policy que precisa
-- checar "e membro da Rede" (mesmo padrao de rede_is_admin em 0005).
create or replace function public.rede_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_convites
    where usado_por = auth.uid()
  );
$$;

revoke all on function public.rede_is_member() from public;
grant execute on function public.rede_is_member() to authenticated, service_role;

-- Supabase's current default no longer auto-exposes new public objects.
-- Keep client privileges minimal; RLS remains the row-level gate.
revoke all
  on table
    public.rede_perfis,
    public.rede_livelinks
  from anon, authenticated, service_role;
grant select, insert, update, delete
  on table
    public.rede_perfis,
    public.rede_livelinks
  to authenticated;
grant select, insert, update, delete
  on table
    public.rede_perfis,
    public.rede_livelinks
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_perfis'
      and policyname = 'rede_perfis: member select'
  ) then
    create policy "rede_perfis: member select"
      on public.rede_perfis
      for select
      to authenticated
      using (public.rede_is_member());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_perfis'
      and policyname = 'rede_perfis: owner insert requires invite'
  ) then
    create policy "rede_perfis: owner insert requires invite"
      on public.rede_perfis
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and public.rede_is_member()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_perfis'
      and policyname = 'rede_perfis: owner update'
  ) then
    create policy "rede_perfis: owner update"
      on public.rede_perfis
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and public.rede_is_member()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_perfis'
      and policyname = 'rede_perfis: owner delete'
  ) then
    create policy "rede_perfis: owner delete"
      on public.rede_perfis
      for delete
      to authenticated
      using (
        auth.uid() = user_id
        and public.rede_is_member()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_livelinks'
      and policyname = 'rede_livelinks: member select'
  ) then
    create policy "rede_livelinks: member select"
      on public.rede_livelinks
      for select
      to authenticated
      using (public.rede_is_member());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_livelinks'
      and policyname = 'rede_livelinks: owner insert requires invite'
  ) then
    create policy "rede_livelinks: owner insert requires invite"
      on public.rede_livelinks
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and public.rede_is_member()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_livelinks'
      and policyname = 'rede_livelinks: owner update'
  ) then
    create policy "rede_livelinks: owner update"
      on public.rede_livelinks
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_livelinks'
      and policyname = 'rede_livelinks: owner delete'
  ) then
    create policy "rede_livelinks: owner delete"
      on public.rede_livelinks
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;
