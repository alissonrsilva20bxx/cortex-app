-- ============================================================
-- JobApp Rede - Migration 0030: retencao de 300 posts sob concorrencia
-- ============================================================
-- Achado na revisao da migration 0028, confirmado empiricamente por
-- tests/rede/concurrency/posts-retencao.concurrency.test.ts: sob READ
-- COMMITTED (padrao do Postgres), cada trigger AFTER INSERT roda dentro
-- da SUA PROPRIA transacao e so enxerga commits que ja terminaram antes
-- dele comecar -- nao os de outras transacoes concorrentes ainda em voo.
-- Com N inserts realmente simultaneos cruzando os 300, varias dessas
-- transacoes calculam "só preciso apagar 1" a partir do MESMO snapshot de
-- baseline, mirando na mesma linha mais antiga -- as demais viram no-op
-- (a linha ja sumiu quando elas tentam), e o excedente de verdade nunca e
-- apagado por completo. Reproduzido: 295 posts seed + 20 inserts
-- concorrentes (Promise.all) convergiu em 304, nao 300.
--
-- Fix: pg_advisory_xact_lock serializa todas as transacoes que disparam
-- este trigger numa fila -- cada uma so roda sua propria checagem depois
-- que a anterior commitou (o lock e liberado no commit/rollback da
-- transacao que o segura). Trade-off aceito: posts passam a ser
-- inseridos em sequencia do ponto de vista da retencao (nao mais
-- paralelizavel), custo desprezivel pra uma comunidade beta pequena.

create or replace function private.rede_enforce_post_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Chave fixa e arbitraria (hash de uma string constante) -- so precisa
  -- ser a MESMA em toda invocação para serializar todas elas entre si;
  -- não precisa ter relação com o id do post inserido.
  perform pg_advisory_xact_lock(hashtext('rede_posts_retention'));

  delete from public.rede_posts
  where id in (
    select id from public.rede_posts
    order by criado_em desc, id desc
    offset 300
  );
  return null;
end;
$$;
