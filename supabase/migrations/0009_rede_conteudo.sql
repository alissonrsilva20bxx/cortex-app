-- ============================================================
-- JobApp Rede - Migration 0009: conteudo (posts, comentarios, curtidas)
-- ============================================================
-- Escopo: MVP, texto puro, nao-anonimo (posts/comentarios anonimos sao
-- proposta separada fora do MVP, ver BETA_DOMAIN_MODEL.md secao 3/4).
-- Leitura de posts e comentarios exclui autores em relacao de bloqueio
-- (nos dois sentidos) com quem le - ver SUPABASE_MIGRATION_PLAN.md secao 2.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_post_categoria'
  ) then
    create type public.rede_post_categoria
      as enum ('conquista', 'dica', 'duvida', 'desabafo');
  end if;
end
$$;

create table if not exists public.rede_posts (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  categoria public.rede_post_categoria not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists rede_posts_updated_at on public.rede_posts;
create trigger rede_posts_updated_at
  before update on public.rede_posts
  for each row execute function public.set_updated_at();

create index if not exists rede_posts_autor_criado_idx
  on public.rede_posts (autor_id, criado_em desc);

create index if not exists rede_posts_categoria_idx
  on public.rede_posts (categoria);

create table if not exists public.rede_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rede_posts(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);

create index if not exists rede_comentarios_post_criado_idx
  on public.rede_comentarios (post_id, criado_em);

create table if not exists public.rede_curtidas (
  post_id uuid not null references public.rede_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Helpers ficam fora do schema exposto pelo PostgREST. Assim as policies
-- evitam recursao de RLS sem oferecer um RPC que revele quem bloqueou quem.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.rede_users_unblocked(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.rede_bloqueios
    where (bloqueador_id = auth.uid() and bloqueado_id = other_user_id)
       or (bloqueador_id = other_user_id and bloqueado_id = auth.uid())
  );
$$;

create or replace function private.rede_post_visible(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_posts post
    where post.id = target_post_id
      and private.rede_users_unblocked(post.autor_id)
  );
$$;

revoke all on function private.rede_users_unblocked(uuid) from public;
revoke all on function private.rede_post_visible(uuid) from public;
grant execute on function private.rede_users_unblocked(uuid)
  to authenticated, service_role;
grant execute on function private.rede_post_visible(uuid)
  to authenticated, service_role;

alter table public.rede_posts enable row level security;
alter table public.rede_comentarios enable row level security;
alter table public.rede_curtidas enable row level security;

-- Supabase's current default no longer auto-exposes new public objects.
-- Keep client privileges minimal; RLS remains the row-level gate.
revoke all
  on table
    public.rede_posts,
    public.rede_comentarios,
    public.rede_curtidas
  from anon, authenticated, service_role;
revoke all on type public.rede_post_categoria from public;

grant usage on type public.rede_post_categoria to authenticated, service_role;
grant select, delete
  on table public.rede_posts, public.rede_comentarios
  to authenticated;
grant select, delete on table public.rede_curtidas
  to authenticated;
grant insert (autor_id, categoria, texto) on table public.rede_posts
  to authenticated;
grant update (categoria, texto) on table public.rede_posts
  to authenticated;
grant insert (post_id, autor_id, texto) on table public.rede_comentarios
  to authenticated;
grant update (texto) on table public.rede_comentarios
  to authenticated;
grant insert (post_id, user_id) on table public.rede_curtidas
  to authenticated;
grant select, insert, update, delete
  on table
    public.rede_posts,
    public.rede_comentarios,
    public.rede_curtidas
  to service_role;

drop policy if exists "rede_posts: member select" on public.rede_posts;
create policy "rede_posts: member select"
  on public.rede_posts
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_users_unblocked(autor_id)
  );

drop policy if exists "rede_posts: owner insert" on public.rede_posts;
create policy "rede_posts: owner insert"
  on public.rede_posts
  for insert
  to authenticated
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
  );

drop policy if exists "rede_posts: owner update" on public.rede_posts;
create policy "rede_posts: owner update"
  on public.rede_posts
  for update
  to authenticated
  using (
    auth.uid() = autor_id
    and public.rede_is_member()
  )
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
  );

drop policy if exists "rede_posts: owner delete" on public.rede_posts;
create policy "rede_posts: owner delete"
  on public.rede_posts
  for delete
  to authenticated
  using (
    auth.uid() = autor_id
    and public.rede_is_member()
  );

drop policy if exists "rede_comentarios: member select" on public.rede_comentarios;
create policy "rede_comentarios: member select"
  on public.rede_comentarios
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_users_unblocked(autor_id)
    and private.rede_post_visible(post_id)
  );

drop policy if exists "rede_comentarios: owner insert" on public.rede_comentarios;
create policy "rede_comentarios: owner insert"
  on public.rede_comentarios
  for insert
  to authenticated
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
    and private.rede_post_visible(post_id)
  );

drop policy if exists "rede_comentarios: owner update" on public.rede_comentarios;
create policy "rede_comentarios: owner update"
  on public.rede_comentarios
  for update
  to authenticated
  using (
    auth.uid() = autor_id
    and public.rede_is_member()
    and private.rede_post_visible(post_id)
  )
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
    and private.rede_post_visible(post_id)
  );

drop policy if exists "rede_comentarios: owner delete" on public.rede_comentarios;
create policy "rede_comentarios: owner delete"
  on public.rede_comentarios
  for delete
  to authenticated
  using (
    auth.uid() = autor_id
    and public.rede_is_member()
  );

drop policy if exists "rede_curtidas: member select" on public.rede_curtidas;
create policy "rede_curtidas: member select"
  on public.rede_curtidas
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_post_visible(post_id)
    and private.rede_users_unblocked(user_id)
  );

drop policy if exists "rede_curtidas: owner insert" on public.rede_curtidas;
create policy "rede_curtidas: owner insert"
  on public.rede_curtidas
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.rede_is_member()
    and private.rede_post_visible(post_id)
  );

drop policy if exists "rede_curtidas: owner delete" on public.rede_curtidas;
create policy "rede_curtidas: owner delete"
  on public.rede_curtidas
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.rede_is_member()
  );

-- Remove a versao antiga exposta via RPC somente depois de substituir todas
-- as policies que poderiam depender dela, permitindo reaplicacao convergente.
drop function if exists public.rede_bloqueio_mutuo(uuid);
