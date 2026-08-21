-- ============================================================
-- JobApp Rede - Migration 0025: categoria "geral" pra publicacoes
-- ============================================================
-- Antes so existiam 4 categorias fixas (conquista/dica/duvida/desabafo)
-- e nenhuma delas servia como "nao quero categorizar" -- o composer
-- (PostComposer.tsx) forcava sempre uma classificacao especifica, mesmo
-- quando a usuaria so queria postar sem escolher nada. "geral" e essa
-- 5a opcao neutra, tratada como o default do composer.
--
-- ALTER TYPE ... ADD VALUE precisa ser a unica instrucao desta migration:
-- Postgres nao deixa usar o valor novo do enum na mesma transacao em que
-- ele foi adicionado (mesma restricao ja documentada na criacao do tipo,
-- migration 0009).

alter type public.rede_post_categoria add value if not exists 'geral';
