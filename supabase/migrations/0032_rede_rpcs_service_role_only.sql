-- ============================================================
-- JobApp Rede - Migration 0032: RPCs da fila de mídia / retenção
--                               realmente restritas a service_role
-- ============================================================
-- Achado validando a 0031 em homologação: as três RPCs abaixo foram
-- criadas (0028, 0029, 0031) com a intenção de serem "service_role only"
-- usando apenas:
--
--     revoke all on function ... from public;
--     grant  execute on function ... to service_role;
--
-- Isso NÃO restringe nada no Supabase. O projeto tem um
-- `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role` -- todo função nova em `public`
-- nasce com `EXECUTE` concedido a `anon` e `authenticated`
-- EXPLICITAMENTE (não pela pseudo-role PUBLIC). `revoke ... from public`
-- não toca nesses grants explícitos, então:
--
--   POST /rest/v1/rpc/rede_posts_retencao_definir_habilitada
--   apikey: <anon key, pública, vai no bundle do navegador>
--   { "habilitada": true }
--
-- ligava a exclusão automática de posts para qualquer visitante. As
-- outras duas deixam qualquer um drenar / reembaralhar a fila de
-- exclusão de mídia.
--
-- Os arquivos 0028 / 0029 / 0031 já foram emendados para revogar de
-- `anon, authenticated` no próprio CREATE -- fecha o buraco em qualquer
-- ambiente que rode do zero (produção, que nunca rodou nenhuma delas).
-- Esta migration faz o mesmo, de forma idempotente, para ambientes que
-- já executaram as versões antigas (homologação). `revoke` de um
-- privilégio que o papel não tem é no-op, sem erro -- segura rodar em
-- qualquer estado.

revoke execute on function public.rede_midia_drenar_pendentes(integer)
  from anon, authenticated;

revoke execute on function public.rede_midia_reenfileirar_pendentes(text[])
  from anon, authenticated;

revoke execute on function public.rede_posts_retencao_definir_habilitada(boolean)
  from anon, authenticated;
