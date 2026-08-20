-- ============================================================
-- JobApp Rede - Migration 0021: persistência real de Wishlist e Clientes
-- ============================================================
-- Issue #64. As duas telas (WishlistScreen/ClientesScreen) eram só
-- `useState` local em RedeTab.tsx desde a rodada corretiva de T12 --
-- rotuladas "Demonstração", sem tabela nenhuma por trás. Decisão de
-- produto (2026-08-19): persistir de verdade.
--
-- Ambas seguem o padrão de dado 100% privado do dono (mesmo espírito de
-- rede_solicitacoes_beta em 0005) -- sem "member select" como
-- rede_livelinks (0006): nenhuma tela hoje expõe Wishlist/Clientes de
-- terceiros (RedeTab.tsx já mantém wishlistPublico/livelinksExibidos
-- vazios pra quem não é o dono), e Clientes em particular é
-- explicitamente "área privada" na própria UI -- ninguém além do dono
-- deveria conseguir ler essas linhas, nunca.

create table if not exists public.rede_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  nome text not null,
  cor text not null,
  valor_alvo numeric(12, 2) not null check (valor_alvo >= 0),
  valor_atual numeric(12, 2) not null default 0 check (valor_atual >= 0),
  estado text not null default 'quero'
    check (estado in ('quero', 'planejando', 'conquistado')),
  privacidade text not null default 'privado'
    check (privacidade in ('privado', 'amigas', 'comunidade')),
  criado_em timestamptz not null default now()
);

create index if not exists rede_wishlist_items_user_idx
  on public.rede_wishlist_items (user_id);

create table if not exists public.rede_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rede_perfis(user_id) on delete cascade,
  nome text not null,
  telefone text not null default '',
  status text not null default 'ativo'
    check (status in ('ativo', 'vip', 'em-negociacao', 'pausado')),
  etiquetas text[] not null default '{}',
  ultimo_contato date not null default current_date,
  observacoes text not null default '',
  criado_em timestamptz not null default now()
);

create index if not exists rede_clientes_user_idx
  on public.rede_clientes (user_id);

alter table public.rede_wishlist_items enable row level security;
alter table public.rede_clientes enable row level security;

revoke all
  on table
    public.rede_wishlist_items,
    public.rede_clientes
  from anon, authenticated, service_role;
grant select, insert, update, delete
  on table
    public.rede_wishlist_items,
    public.rede_clientes
  to authenticated;
grant select, insert, update, delete
  on table
    public.rede_wishlist_items,
    public.rede_clientes
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_wishlist_items'
      and policyname = 'rede_wishlist_items: owner select'
  ) then
    create policy "rede_wishlist_items: owner select"
      on public.rede_wishlist_items
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_wishlist_items'
      and policyname = 'rede_wishlist_items: owner insert requires invite'
  ) then
    create policy "rede_wishlist_items: owner insert requires invite"
      on public.rede_wishlist_items
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
      and tablename = 'rede_wishlist_items'
      and policyname = 'rede_wishlist_items: owner update'
  ) then
    create policy "rede_wishlist_items: owner update"
      on public.rede_wishlist_items
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_wishlist_items'
      and policyname = 'rede_wishlist_items: owner delete'
  ) then
    create policy "rede_wishlist_items: owner delete"
      on public.rede_wishlist_items
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_clientes'
      and policyname = 'rede_clientes: owner select'
  ) then
    create policy "rede_clientes: owner select"
      on public.rede_clientes
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_clientes'
      and policyname = 'rede_clientes: owner insert requires invite'
  ) then
    create policy "rede_clientes: owner insert requires invite"
      on public.rede_clientes
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
      and tablename = 'rede_clientes'
      and policyname = 'rede_clientes: owner update'
  ) then
    create policy "rede_clientes: owner update"
      on public.rede_clientes
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rede_clientes'
      and policyname = 'rede_clientes: owner delete'
  ) then
    create policy "rede_clientes: owner delete"
      on public.rede_clientes
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;
