-- ============================================================
-- JobApp Rede - Migration 0028: fotos em posts, retenção e limpeza
-- ============================================================
-- Escopo: publicação com 0-2 fotos por post, paginação (feed.ts, sem SQL
-- novo -- só troca full-scan por cursor), retenção global de 300 posts e
-- limpeza dos arquivos de Storage correspondentes.
--
-- Bucket "rede-midia": reaproveita o desenho já proposto em
-- docs/rede/SUPABASE_MIGRATION_PLAN.md secao 5 (privado, 10MB, path
-- {user_id}/posts/{post_id}/{filename}), com uma correção: a leitura NÃO é
-- aberta a qualquer membro -- precisa respeitar bloqueio mútuo, igual a
-- rede_posts/rede_comentarios (0009), senão uma pessoa bloqueada continua
-- vendo as fotos de quem a bloqueou (ou vice-versa) só por ter a URL.
--
-- Retenção (decisão assumida nesta implementação, a confirmar com produto
-- antes de ligar contra o banco compartilhado): global, não por autora --
-- o total de linhas em rede_posts nunca passa de 300; ao inserir a 301a,
-- as mais antigas em excesso são apagadas na mesma transação. Isso casca
-- para rede_comentarios/rede_curtidas/rede_post_fotos (FKs already ON
-- DELETE CASCADE) -- mas o arquivo físico no Storage não tem FK nenhuma
-- (storage.objects não referencia rede_post_fotos), então a limpeza real
-- do arquivo não pode acontecer só com um DELETE em SQL: fica numa fila
-- (private.rede_midia_pendente_exclusao), drenada por
-- public.rede_midia_drenar_pendentes(), chamada pela rota de cron
-- app/api/cron/rede-midia-limpeza (server-side, service_role, chama a
-- API de Storage de verdade -- só ela apaga o blob).
--
-- Exclusão manual (excluirPost) usa o mesmo mecanismo de fila só como
-- rede de segurança; o caminho feliz chama storage.remove() direto no
-- cliente, na hora, sem esperar o cron (ver lib/rede/feed.ts).

-- ---------------------------------------------------------------
-- 1. Tabela rede_post_fotos
-- ---------------------------------------------------------------

create table if not exists public.rede_post_fotos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.rede_posts(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  -- `ordem in (1,2)` + `unique(post_id, ordem)` já garante o teto de 2
  -- fotos por post sem precisar de trigger de contagem.
  ordem smallint not null check (ordem in (1, 2)),
  criado_em timestamptz not null default now(),
  unique (post_id, ordem)
);

create index if not exists rede_post_fotos_post_idx
  on public.rede_post_fotos (post_id);

alter table public.rede_post_fotos enable row level security;

revoke all on table public.rede_post_fotos from anon, authenticated, service_role;
grant select on table public.rede_post_fotos to authenticated;
grant insert (post_id, autor_id, path, ordem) on table public.rede_post_fotos
  to authenticated;
grant delete on table public.rede_post_fotos to authenticated;
grant select, insert, update, delete on table public.rede_post_fotos
  to service_role;

drop policy if exists "rede_post_fotos: member select" on public.rede_post_fotos;
create policy "rede_post_fotos: member select"
  on public.rede_post_fotos
  for select
  to authenticated
  using (
    public.rede_is_member()
    and private.rede_post_visible(post_id)
  );

drop policy if exists "rede_post_fotos: owner insert" on public.rede_post_fotos;
create policy "rede_post_fotos: owner insert"
  on public.rede_post_fotos
  for insert
  to authenticated
  with check (
    auth.uid() = autor_id
    and public.rede_is_member()
    and exists (
      select 1 from public.rede_posts p
      where p.id = post_id and p.autor_id = auth.uid()
    )
  );

drop policy if exists "rede_post_fotos: owner delete" on public.rede_post_fotos;
create policy "rede_post_fotos: owner delete"
  on public.rede_post_fotos
  for delete
  to authenticated
  using (auth.uid() = autor_id);

-- ---------------------------------------------------------------
-- 2. Bucket de Storage rede-midia + policies (bloqueio-aware)
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'rede-midia',
    'rede-midia',
    false,
    10485760, -- 10 MB, mesmo teto do cofre (docs/adr/0002)
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
  on conflict (id) do nothing;

-- Extrai o dono do path (1o segmento) com guarda contra nome mal-formado
-- (ex.: objetos internos do Storage tipo `.emptyFolderPlaceholder`) -- um
-- cast direto pra uuid dentro da propria policy derrubaria a query inteira
-- se UMA linha nao bater no formato esperado, nao so aquela linha.
create or replace function private.rede_midia_pode_ler(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  begin
    owner_id := ((string_to_array(object_name, '/'))[1])::uuid;
  exception when others then
    return false;
  end;
  return public.rede_is_member() and private.rede_users_unblocked(owner_id);
end;
$$;

revoke all on function private.rede_midia_pode_ler(text) from public;
grant execute on function private.rede_midia_pode_ler(text)
  to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'rede-midia: owner insert'
  ) then
    create policy "rede-midia: owner insert"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'rede-midia'
        and public.rede_is_member()
        and auth.uid()::text = (string_to_array(name, '/'))[1]
        and (string_to_array(name, '/'))[2] = 'posts'
        and exists (
          select 1 from public.rede_posts p
          where p.id::text = (string_to_array(name, '/'))[3]
            and p.autor_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'rede-midia: member select (bloqueio)'
  ) then
    create policy "rede-midia: member select (bloqueio)"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'rede-midia'
        and private.rede_midia_pode_ler(name)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'rede-midia: owner delete'
  ) then
    create policy "rede-midia: owner delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'rede-midia'
        and auth.uid()::text = (string_to_array(name, '/'))[1]
      );
  end if;
end
$$;

-- ---------------------------------------------------------------
-- 3. Retenção: no máximo 300 posts (global), aplicada a cada INSERT
-- ---------------------------------------------------------------

create or replace function private.rede_enforce_post_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Mantém as 300 mais recentes; ordenar por mais-recente-primeiro e pular
  -- essas 300 devolve exatamente o excesso antigo a apagar. Inverter pra
  -- `asc` (mais-antiga-primeiro) apagaria a mais NOVA em vez da mais
  -- velha -- bug real pego pelo teste de integração
  -- (tests/rede/rls/rede_posts_retencao.rls.test.ts).
  delete from public.rede_posts
  where id in (
    select id from public.rede_posts
    order by criado_em desc, id desc
    offset 300
  );
  return null;
end;
$$;

drop trigger if exists rede_posts_retention on public.rede_posts;
create trigger rede_posts_retention
  after insert on public.rede_posts
  for each row
  execute function private.rede_enforce_post_retention();

-- Nasce DESATIVADO de propósito: é uma operação destrutiva (apaga posts
-- de verdade) e não pode ligar sozinha só porque esta migration rodou --
-- ativação é um passo manual, explícito, separado, só depois do código
-- que avisa a usuária (aviso de exclusão automática no composer, PR #105)
-- já estar no ar. Ver "Runbook de ativação" no PR #105 / docs/rede.
--
-- CREATE + DISABLE na MESMA transação desta migration (cada arquivo de
-- migration roda como uma transação só) -- nenhuma sessão concorrente
-- jamais observa o trigger habilitado, nem por uma fração de segundo,
-- mesmo em rede_posts já recebendo INSERTs reais (não é tabela nova).
-- Ambientes que já tinham rodado esta migration ANTES desta linha existir
-- (ex.: homologação) precisam da migration 0031, que traz o mesmo efeito
-- de forma idempotente.
alter table public.rede_posts disable trigger rede_posts_retention;

-- ---------------------------------------------------------------
-- 4. Fila de exclusão de mídia + dreno (service_role only)
-- ---------------------------------------------------------------

create table if not exists private.rede_midia_pendente_exclusao (
  path text primary key,
  criado_em timestamptz not null default now()
);

create or replace function private.rede_post_fotos_marcar_exclusao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.rede_midia_pendente_exclusao (path)
  values (old.path)
  on conflict (path) do nothing;
  return old;
end;
$$;

drop trigger if exists rede_post_fotos_exclusao on public.rede_post_fotos;
create trigger rede_post_fotos_exclusao
  after delete on public.rede_post_fotos
  for each row
  execute function private.rede_post_fotos_marcar_exclusao();

-- RPC exposta via PostgREST só para service_role (a rota de cron chama com
-- o client admin) -- lê e já remove da fila num único passo atômico, pra
-- duas execuções concorrentes do cron nunca pegarem o mesmo path.
create or replace function public.rede_midia_drenar_pendentes(lote integer default 100)
returns table (path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `path` bare seria ambíguo aqui -- RETURNS TABLE(path text) cria uma
  -- variável de saída `path` no escopo da função, que colide com a coluna
  -- de mesmo nome (erro 42702, pego pelo teste de integração). Qualifica
  -- a referência da coluna explicitamente em vez de confiar no bare name.
  return query
  delete from private.rede_midia_pendente_exclusao
  where private.rede_midia_pendente_exclusao.path in (
    select p.path from private.rede_midia_pendente_exclusao p
    order by p.criado_em asc
    limit greatest(lote, 0)
  )
  returning private.rede_midia_pendente_exclusao.path;
end;
$$;

-- `from public` sozinho nao basta no Supabase -- o `alter default
-- privileges` do projeto concede execute a `anon` e `authenticated`
-- explicitamente (nao via PUBLIC), e esses grants sobrevivem ao revoke.
-- Sem revogar dos dois, qualquer um com a anon key drena a fila de
-- exclusao de midia via PostgREST. Ver migration 0032.
revoke all on function public.rede_midia_drenar_pendentes(integer)
  from public, anon, authenticated;
grant execute on function public.rede_midia_drenar_pendentes(integer) to service_role;
