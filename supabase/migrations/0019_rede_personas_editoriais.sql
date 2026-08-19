-- ============================================================
-- JobApp Rede - Migration 0019: personas editoriais
-- ============================================================
-- Decisao de produto (issue #80): perfis-semente do feed viram personas
-- editoriais ficticias -- rotuladas, auditadas, nunca personificando
-- pessoa real -- substituindo a ideia original de #78 ("responder como
-- usuaria real"), que conflitava com a clausula anti-impersonacao repetida
-- em todas as issues T13-T24.
--
-- Personas NAO sao linhas de auth.users nem de rede_perfis (cuja PK e
-- literalmente auth.users(id)) -- por isso ja e estruturalmente impossivel
-- uma persona aparecer como autor_id/solicitante_id/bloqueador_id/etc. nas
-- tabelas que referenciam auth.users(id): a FK rejeita qualquer id que nao
-- seja uma conta real. A "negacao explicita" pedida no ticket #81 e provada
-- por teste (RLS suite, caso "rejects a persona id used as a real user id"),
-- nao por um mecanismo novo que duplicaria a FK.
--
-- Leitura publica (membro comum vendo o perfil "Perfil editorial" de uma
-- persona) fica fora deste ticket -- aqui SELECT e admin-only, igual
-- INSERT/UPDATE. Uma exposicao read-safe (provavelmente uma RPC estreita,
-- no espirito de rede_listar_bloqueados em 0018) e decisao dos tickets de
-- RPC/UI (#82/#83), nao deste schema.
--
-- Pendente de aplicacao remota e de nova autorizacao humana antes do
-- lancamento -- validado e aplicado so no Supabase local descartavel neste
-- ticket, mesmo protocolo de 0016-0018.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rede_persona_status'
  ) then
    create type public.rede_persona_status
      as enum ('ativa', 'pausada', 'arquivada');
  end if;
end
$$;

create table if not exists public.rede_personas_editoriais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor_avatar text not null,
  biografia text,
  is_editorial boolean not null default true,
  status public.rede_persona_status not null default 'ativa',
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_auditoria uuid not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint rede_personas_editoriais_nome_valido
    check (char_length(btrim(nome)) between 1 and 120),
  constraint rede_personas_editoriais_biografia_valida
    check (
      biografia is null
      or char_length(btrim(biografia)) between 1 and 2000
    ),
  -- Imutabilidade de schema, nao so de UI/trigger: is_editorial nunca pode
  -- ser gravado como false -- garante "nunca converter persona editorial
  -- em conta real" mesmo contra um UPDATE que escape da RLS/trigger.
  constraint rede_personas_editoriais_is_editorial_sempre_true
    check (is_editorial = true)
);

create index if not exists rede_personas_editoriais_status_idx
  on public.rede_personas_editoriais (status);

create table if not exists public.rede_personas_auditoria (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.rede_personas_editoriais(id)
    on delete restrict,
  admin_id uuid references auth.users(id) on delete set null,
  admin_id_auditoria uuid not null,
  acao text not null,
  conteudo jsonb,
  criado_em timestamptz not null default now(),
  constraint rede_personas_auditoria_acao_valida
    check (
      acao in (
        'criada',
        'editada',
        'post_publicado',
        'resposta_publica',
        'pausada',
        'arquivada'
      )
    )
);

create index if not exists rede_personas_auditoria_persona_idx
  on public.rede_personas_auditoria (persona_id, criado_em);

create or replace function public.rede_validar_persona_editorial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Passagem interna: ON DELETE SET NULL do FK criado_por quando a conta
  -- do admin criador e removida. Preserva todo o resto, inclusive status.
  if auth.uid() is null
    and new.criado_por is null
    and old.criado_por is not null
    and new.nome = old.nome
    and new.cor_avatar = old.cor_avatar
    and new.biografia is not distinct from old.biografia
    and new.status = old.status
    and new.criado_por_auditoria = old.criado_por_auditoria
    and new.criado_em = old.criado_em
  then
    return new;
  end if;

  if old.status = 'arquivada' then
    raise exception 'persona arquivada e imutavel' using errcode = '23514';
  end if;

  if new.criado_por_auditoria <> old.criado_por_auditoria
    or new.criado_em <> old.criado_em
  then
    raise exception 'campos imutaveis da persona editorial'
      using errcode = '23514';
  end if;

  if new.status <> old.status
    and not (
      (old.status = 'ativa' and new.status in ('pausada', 'arquivada'))
      or (old.status = 'pausada' and new.status in ('ativa', 'arquivada'))
    )
  then
    raise exception 'transicao de status invalida' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists rede_personas_editoriais_validar
  on public.rede_personas_editoriais;
create trigger rede_personas_editoriais_validar
  before update on public.rede_personas_editoriais
  for each row execute function public.rede_validar_persona_editorial();

drop trigger if exists rede_personas_editoriais_updated_at
  on public.rede_personas_editoriais;
create trigger rede_personas_editoriais_updated_at
  before update on public.rede_personas_editoriais
  for each row execute function public.set_updated_at();

alter table public.rede_personas_editoriais enable row level security;
alter table public.rede_personas_auditoria enable row level security;

revoke all
  on table
    public.rede_personas_editoriais,
    public.rede_personas_auditoria
  from anon, authenticated, service_role;
revoke all on type public.rede_persona_status from public;
revoke all on function public.rede_validar_persona_editorial() from public;

grant usage on type public.rede_persona_status
  to authenticated, service_role;

-- SELECT/INSERT/UPDATE admin-only. is_editorial/criado_por_auditoria/
-- criado_em ficam de fora dos grants de coluna de UPDATE -- imutaveis mesmo
-- que uma policy futura relaxe o "using()" geral.
grant select on table public.rede_personas_editoriais to authenticated;
grant insert (nome, cor_avatar, biografia, criado_por, criado_por_auditoria)
  on table public.rede_personas_editoriais
  to authenticated;
grant update (nome, cor_avatar, biografia, status)
  on table public.rede_personas_editoriais
  to authenticated;
grant select, insert, update, delete
  on table public.rede_personas_editoriais
  to service_role;

-- Auditoria: leitura e insercao admin-only, nunca UPDATE/DELETE para
-- nenhum usuario autenticado -- so service_role (fixtures/scripts) mantem
-- acesso total, mesmo padrao do restante do schema da Rede.
grant select on table public.rede_personas_auditoria to authenticated;
grant insert (persona_id, admin_id, admin_id_auditoria, acao, conteudo)
  on table public.rede_personas_auditoria
  to authenticated;
grant select, insert, update, delete
  on table public.rede_personas_auditoria
  to service_role;

drop policy if exists "rede_personas_editoriais: admin select"
  on public.rede_personas_editoriais;
create policy "rede_personas_editoriais: admin select"
  on public.rede_personas_editoriais
  for select
  to authenticated
  using (public.rede_is_admin());

drop policy if exists "rede_personas_editoriais: admin insert"
  on public.rede_personas_editoriais;
create policy "rede_personas_editoriais: admin insert"
  on public.rede_personas_editoriais
  for insert
  to authenticated
  with check (
    public.rede_is_admin()
    and criado_por = auth.uid()
    and criado_por_auditoria = auth.uid()
  );

drop policy if exists "rede_personas_editoriais: admin update"
  on public.rede_personas_editoriais;
create policy "rede_personas_editoriais: admin update"
  on public.rede_personas_editoriais
  for update
  to authenticated
  using (public.rede_is_admin())
  with check (public.rede_is_admin());

drop policy if exists "rede_personas_auditoria: admin select"
  on public.rede_personas_auditoria;
create policy "rede_personas_auditoria: admin select"
  on public.rede_personas_auditoria
  for select
  to authenticated
  using (public.rede_is_admin());

drop policy if exists "rede_personas_auditoria: admin insert own action"
  on public.rede_personas_auditoria;
create policy "rede_personas_auditoria: admin insert own action"
  on public.rede_personas_auditoria
  for insert
  to authenticated
  with check (
    public.rede_is_admin()
    and admin_id = auth.uid()
    and admin_id_auditoria = auth.uid()
  );
