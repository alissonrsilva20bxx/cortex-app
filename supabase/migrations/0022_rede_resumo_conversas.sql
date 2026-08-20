-- ============================================================
-- JobApp Rede - Migration 0022: resumo de conversas (issue #54)
-- ============================================================
-- listarConversas() buscava TODAS as mensagens de TODAS as conversas da
-- usuária só pra reduzir, em memória, à última mensagem de cada uma (e
-- contar não lidas) -- achado P1 #3 da auditoria visual de T9. Move essa
-- agregação pro banco: uma linha por conversa, já com a última mensagem
-- e a contagem de não lidas prontas.
--
-- `language sql` sem `security definer` -- direitos de invocador (padrão),
-- então as subconsultas contra rede_conversas_participantes/rede_mensagens
-- continuam sujeitas à RLS de quem chama (participante + membro + não
-- bloqueado, já garantido pela policy de select de rede_conversas_
-- participantes desde 0010). O filtro `cp.user_id = auth.uid()` aqui é
-- sobre CORRETUDE (sem ele, cada conversa apareceria 2x, uma por
-- participante), a segurança em si já vem da RLS das tabelas de baixo.

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
  where cp.user_id = auth.uid();
$$;

revoke all on function public.rede_listar_resumo_conversas() from public;
grant execute on function public.rede_listar_resumo_conversas()
  to authenticated, service_role;
