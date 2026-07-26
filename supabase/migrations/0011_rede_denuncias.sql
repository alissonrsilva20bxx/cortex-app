-- ============================================================
-- JobApp Rede - Migration 0011: denuncias (fila minima de moderacao)
-- ============================================================
-- Escopo: MVP (fila minima - registrar e permitir que admin marque como
-- revisada/resolvida; nao e workflow de moderacao completo).
-- Alvo e polimorfico (post/comentario/usuario/mensagem): alvo_id nao tem FK
-- tipada, ver BETA_DOMAIN_MODEL.md secao 7.
-- Denunciante ve so a propria denuncia; somente quem esta em rede_admins
-- ve todas e consegue mudar status (SUPABASE_MIGRATION_PLAN.md secao 2).

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_denuncia_alvo_tipo'
  ) then
    create type public.rede_denuncia_alvo_tipo
      as enum ('post', 'comentario', 'usuario', 'mensagem');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_denuncia_motivo'
  ) then
    create type public.rede_denuncia_motivo
      as enum ('spam', 'assedio', 'conteudo_impropio', 'outro');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_denuncia_status'
  ) then
    create type public.rede_denuncia_status
      as enum ('pendente', 'revisada', 'resolvida');
  end if;
end
$$;

create table if not exists public.rede_denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references auth.users(id) on delete cascade,
  alvo_tipo public.rede_denuncia_alvo_tipo not null,
  alvo_id uuid not null,
  motivo public.rede_denuncia_motivo not null,
  descricao text,
  status public.rede_denuncia_status not null default 'pendente',
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  -- on delete set null (nao cascade): remover a conta do admin nao deveria
  -- apagar o registro de que a denuncia foi revisada.
  revisado_por uuid references auth.users(id) on delete set null,
  constraint rede_denuncias_descricao_valida check (
    descricao is null
    or char_length(btrim(descricao)) between 1 and 2000
  ),
  constraint rede_denuncias_revisao_consistente check (
    (status = 'pendente' and revisado_em is null and revisado_por is null)
    or (
      status <> 'pendente'
      and revisado_em is not null
      and revisado_por is not null
    )
  )
);

create index if not exists rede_denuncias_status_idx
  on public.rede_denuncias (status);

create index if not exists rede_denuncias_denunciante_idx
  on public.rede_denuncias (denunciante_id);

create index if not exists rede_denuncias_alvo_idx
  on public.rede_denuncias (alvo_tipo, alvo_id);

-- Trilha unica permitida: pendente -> revisada|resolvida, revisada ->
-- resolvida. Nunca volta para pendente; resolvida e terminal. Quem revisa
-- so pode registrar a si mesmo como revisor.
create or replace function public.rede_validar_revisao_denuncia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status not in ('pendente', 'revisada') or new.status = 'pendente' then
    raise exception 'transicao de denuncia invalida'
      using errcode = '23514';
  end if;

  if new.revisado_em is null
    or new.revisado_por is null
    or new.revisado_por <> auth.uid()
  then
    raise exception 'transicao de denuncia invalida'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rede_denuncias_validar_revisao
  on public.rede_denuncias;
create trigger rede_denuncias_validar_revisao
  before update on public.rede_denuncias
  for each row execute function public.rede_validar_revisao_denuncia();

alter table public.rede_denuncias enable row level security;

-- Supabase's current default no longer auto-exposes new public objects.
-- Keep client privileges minimal; RLS remains the row-level gate.
revoke all on table public.rede_denuncias from anon, authenticated, service_role;
revoke all on function public.rede_validar_revisao_denuncia() from public;
revoke all
  on type
    public.rede_denuncia_alvo_tipo,
    public.rede_denuncia_motivo,
    public.rede_denuncia_status
  from public;

grant usage
  on type
    public.rede_denuncia_alvo_tipo,
    public.rede_denuncia_motivo,
    public.rede_denuncia_status
  to authenticated, service_role;
grant select on table public.rede_denuncias to authenticated;
grant insert (denunciante_id, alvo_tipo, alvo_id, motivo, descricao)
  on table public.rede_denuncias
  to authenticated;
grant update (status, revisado_em, revisado_por)
  on table public.rede_denuncias
  to authenticated;
grant select, insert, update, delete
  on table public.rede_denuncias
  to service_role;

drop policy if exists "rede_denuncias: reporter or admin select"
  on public.rede_denuncias;
create policy "rede_denuncias: reporter or admin select"
  on public.rede_denuncias
  for select
  to authenticated
  using (
    denunciante_id = auth.uid()
    or public.rede_is_admin()
  );

drop policy if exists "rede_denuncias: reporter insert"
  on public.rede_denuncias;
create policy "rede_denuncias: reporter insert"
  on public.rede_denuncias
  for insert
  to authenticated
  with check (
    denunciante_id = auth.uid()
    and public.rede_is_member()
    and status = 'pendente'
    and revisado_em is null
    and revisado_por is null
  );

drop policy if exists "rede_denuncias: admin update status"
  on public.rede_denuncias;
create policy "rede_denuncias: admin update status"
  on public.rede_denuncias
  for update
  to authenticated
  using (public.rede_is_admin())
  with check (public.rede_is_admin());
