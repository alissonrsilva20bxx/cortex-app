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

-- Reaproveita o helper de bloqueio mutuo em ambas as tabelas de conteudo,
-- mesmo padrao de rede_is_member (0006): security definer evita repetir a
-- subquery em rede_bloqueios em toda policy que precisa dessa checagem.
create or replace function public.rede_bloqueio_mutuo(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rede_bloqueios
    where (bloqueador_id = auth.uid() and bloqueado_id = alvo)
       or (bloqueador_id = alvo and bloqueado_id = auth.uid())
  );
$$;

revoke all on function public.rede_bloqueio_mutuo(uuid) from public;
grant execute on function public.rede_bloqueio_mutuo(uuid)
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
grant select, insert, update, delete
  on table
    public.rede_posts,
    public.rede_comentarios
  to authenticated;
grant select, insert, delete
  on table public.rede_curtidas
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
    and not public.rede_bloqueio_mutuo(autor_id)
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
  using (auth.uid() = autor_id)
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
    and not public.rede_bloqueio_mutuo(autor_id)
  );

drop policy if exists "rede_comentarios: owner insert" on public.rede_comentarios;
create policy "rede_comentarios: owner insert"
  on public.rede_comentarios
  for insert
  to authenticated
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
  );

drop policy if exists "rede_comentarios: owner update" on public.rede_comentarios;
create policy "rede_comentarios: owner update"
  on public.rede_comentarios
  for update
  to authenticated
  using (auth.uid() = autor_id)
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
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
  using (public.rede_is_member());

drop policy if exists "rede_curtidas: owner insert" on public.rede_curtidas;
create policy "rede_curtidas: owner insert"
  on public.rede_curtidas
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.rede_is_member()
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
