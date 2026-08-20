-- ============================================================
-- JobApp Rede - Migration 0024: resumo de conversas respeita ocultar (#54 + #55)
-- ============================================================
-- Reconciliação de merge entre PR #92 (issue #54, resumo de conversas
-- agregado no banco) e PR #93 (issue #55, excluir conversa só pro meu
-- lado via rede_conversas_participantes.oculta_desde, migration 0023).
-- Os dois PRs foram desenvolvidos em paralelo sem dependência entre si
-- e chegaram a implementações independentes de "listarConversas" -- esta
-- migration move o filtro de "conversa oculta" (issue #55) pra dentro
-- da RPC de resumo (issue #54) em vez de manter as duas lógicas
-- separadas (uma em SQL, outra em JS), evitando divergência futura.
--
-- Mesma regra de antes (só que agora dentro da RPC): uma conversa com
-- oculta_desde definido só continua na lista se NÃO houver mensagem
-- nova desde a exclusão -- reaparece sozinha, sem RPC de "desocultar".

create or replace function public.rede_listar_resumo_conversas()
returns table (
  conversa_id uuid,
  outro_user_id uuid,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  nao_lidas bigint
)
language sql
stable
set search_path = ''
as $$
  select
    cp.conversa_id,
    outro.user_id as outro_user_id,
    ultima.texto as ultima_mensagem,
    ultima.criado_em as ultima_mensagem_em,
    coalesce(nl.total, 0) as nao_lidas
  from public.rede_conversas_participantes cp
  join public.rede_conversas_participantes outro
    on outro.conversa_id = cp.conversa_id
    and outro.user_id <> cp.user_id
  left join lateral (
    select m.texto, m.criado_em
    from public.rede_mensagens m
    where m.conversa_id = cp.conversa_id
    order by m.criado_em desc
    limit 1
  ) ultima on true
  left join lateral (
    select count(*) as total
    from public.rede_mensagens m2
    where m2.conversa_id = cp.conversa_id
      and m2.autor_id <> cp.user_id
      and m2.lida_em is null
  ) nl on true
  where cp.user_id = auth.uid()
    and (
      cp.oculta_desde is null
      or (ultima.criado_em is not null and ultima.criado_em > cp.oculta_desde)
    );
$$;
