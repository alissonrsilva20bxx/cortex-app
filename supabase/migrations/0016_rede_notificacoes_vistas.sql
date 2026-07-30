-- ============================================================
-- JobApp Rede - Migration 0016: cursor de notificacoes vistas
-- ============================================================
-- Curtida/comentario/pedido de amizade nao tem coluna de leitura propria
-- (mensagem ja tem lida_em, ver 0010). Em vez de uma tabela nova de
-- eventos com "lida" por linha, a notificacao agregada (lib/rede/
-- notificacoes.ts) e derivada client-side das tabelas existentes e
-- comparada contra este cursor unico por usuaria: tudo criado ate aqui
-- conta como visto. "Marcar todas como lidas" so avanca este timestamp.

alter table public.rede_perfis
  add column if not exists notificacoes_vistas_em timestamptz;
