-- ============================================================
-- JobApp — Migration 0045: ajustes finais (índices)
-- ============================================================
-- ESCRITA, NÃO APLICADA. Roda no Supabase SQL Editor quando o dono decidir,
-- depois de 0044. Pedido do capitão em 2026-10-20.
--
-- O que faz: cria os índices que faltavam em `guardar_historico`.
--
-- Por quê / o que foi conferido:
--   - `guardar_historico` (0044) não tinha índice nenhum além do id:
--       * (user_id, data desc) — "meus depósitos", mais recentes primeiro;
--       * (desejo_id, data desc) — depósitos de um Desejo e a soma de
--         valor_atual; também evita varrer a tabela no on delete cascade
--         quando um Desejo é apagado.
--   - Os comentários de 0042–0045 estão todos em português.
--
-- `create index if not exists`: rodar de novo não faz nada.

create index if not exists guardar_historico_user_data_idx
  on public.guardar_historico (user_id, data desc);

create index if not exists guardar_historico_desejo_data_idx
  on public.guardar_historico (desejo_id, data desc);

-- Conferência: deve listar os 2 índices acima.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'guardar_historico_user_data_idx',
    'guardar_historico_desejo_data_idx'
  )
order by tablename, indexname;

-- ------------------------------------------------------------
-- TESTE (rodar à parte). As consultas que o app faz hoje e as novas,
-- como usuária autenticada, dentro de ROLLBACK. Esperado: todas rodam sem
-- erro (podem voltar vazias).
-- ------------------------------------------------------------
-- begin;
--   select set_config('request.jwt.claims', json_build_object(
--     'sub', (select usado_por from public.rede_convites where usado_por is not null limit 1),
--     'role', 'authenticated')::text, true);
--   set local role authenticated;
--
--   select id, nome, valor_alvo, valor_atual, estado, prazo
--     from public.rede_wishlist_items where user_id = auth.uid();
--   select desejo_id, sum(valor) from public.guardar_historico
--     where user_id = auth.uid() group by desejo_id;
-- rollback;
