-- ============================================================
-- JobApp Rede - Migration 0033: fotos otimizadas + upload só pela rota
-- ============================================================
-- A entrega original (0028) subia o arquivo CRU do <input> direto pro
-- Storage, pelo cliente -- sem compressão, sem resize, sem remoção de
-- EXIF/GPS, sem miniatura -- e a paginação do feed era 20 (o escopo pede
-- 10). Requisitos pendentes, não melhoria futura.
--
-- Esta migration + a rota `app/api/rede/foto-upload` fecham isso:
--   1. `rede_post_fotos` ganha `thumb_path` (nullable -- fotos legadas de
--      antes desta migration continuam funcionando, sem miniatura).
--   2. O trigger de limpeza passa a enfileirar principal E miniatura.
--   3. O cliente PERDE o INSERT direto em `storage.objects` (bucket
--      rede-midia) e em `rede_post_fotos`. A partir daqui só a rota
--      autenticada grava, via service_role, DEPOIS de validar dimensões,
--      tamanho e formato e remover metadados. Assim um upload direto
--      (curl com a anon key, SDK no console) não tem como contornar a
--      validação.
--   4. Bucket `rede-midia`: só `image/jpeg`, teto de 160 KiB (defesa em
--      profundidade -- a rota já garante 150 KB na principal e 30 KB na
--      miniatura; o teto do bucket é a rede de segurança se a rota tiver
--      bug).
--
-- SELECT (bloqueio-aware) e DELETE do cliente CONTINUAM: o feed assina
-- URLs de leitura e o `excluirPost` remove os blobs na hora (o cron de
-- limpeza é só a rede de segurança pra falha parcial).

-- ---------------------------------------------------------------
-- 1. Coluna da miniatura
-- ---------------------------------------------------------------
alter table public.rede_post_fotos
  add column if not exists thumb_path text;

-- `unique` num índice separado (não inline) pra poder ser parcial: várias
-- fotos legadas com thumb_path NULL não podem colidir entre si.
create unique index if not exists rede_post_fotos_thumb_path_key
  on public.rede_post_fotos (thumb_path)
  where thumb_path is not null;

-- ---------------------------------------------------------------
-- 2. Trigger de limpeza: enfileira principal + miniatura
-- ---------------------------------------------------------------
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

  if old.thumb_path is not null then
    insert into private.rede_midia_pendente_exclusao (path)
    values (old.thumb_path)
    on conflict (path) do nothing;
  end if;

  return old;
end;
$$;

-- ---------------------------------------------------------------
-- 3. Tira o INSERT direto do cliente (upload só pela rota)
-- ---------------------------------------------------------------
-- `rede_post_fotos`: a linha passa a ser inserida pela rota (service_role,
-- que ignora RLS). Remove a policy de INSERT do `authenticated` e revoga
-- o privilégio de tabela -- os dois, defesa em profundidade.
drop policy if exists "rede_post_fotos: owner insert" on public.rede_post_fotos;
-- 0028 deu grant de coluna (`grant insert (post_id, autor_id, path, ordem)`)
-- -- revoga tabela E colunas; sem policy de INSERT o `authenticated` já
-- não insere, isto é só defesa em profundidade.
revoke insert on table public.rede_post_fotos from authenticated;
revoke insert (id, post_id, autor_id, path, thumb_path, ordem, criado_em)
  on table public.rede_post_fotos from authenticated;

-- Storage: sem policy de INSERT, nem `authenticated` nem `anon` conseguem
-- `storage.from('rede-midia').upload(...)`. Só o service_role (rota).
drop policy if exists "rede-midia: owner insert" on storage.objects;

-- ---------------------------------------------------------------
-- 4. Trava de bucket: formato e tamanho
-- ---------------------------------------------------------------
update storage.buckets
  set file_size_limit   = 163840,               -- 160 KiB
      allowed_mime_types = array['image/jpeg']
  where id = 'rede-midia';
