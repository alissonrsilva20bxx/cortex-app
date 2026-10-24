# Ordem para aplicar as migrations ainda não aplicadas

Atualizado em 23/10/2026 (madrugada).

## Primeiro: conferir o que já está no banco

O estado do banco de produção é **desconhecido**. Ninguém conferiu quais migrations já foram aplicadas. Antes de rodar qualquer uma:

1. Abra o Supabase, escolha o projeto certo (Cortex App, `seciereacfestemdhzhp`), abra o **SQL Editor**.
2. Rode as consultas de "já aplicada?" de cada item abaixo. Se o resultado indicar que já existe, pule o item.
3. Todas as migrations aqui usam `if not exists` ou `create or replace`, então rodar de novo por engano não estraga, mas confira mesmo assim.

## A ordem

Para cada item: abrir o SQL Editor, colar o arquivo inteiro, clicar **Run**, depois rodar a consulta de conferência.

### 1. `0040_assinatura_so_servidor.sql`
Faz: só o servidor (Stripe) muda o status da assinatura. A usuária não consegue se dar "ativa" nem reiniciar o teste grátis apagando a própria linha.
- Já aplicada? `select tgname from pg_trigger where tgname in ('configuracoes_assinatura_so_servidor','configuracoes_sem_delete_pela_sessao');` Se voltar as 2 linhas, já está.
- Conferência depois: a mesma consulta deve devolver as 2 linhas.

### 2. `0042_desejo_objetivo_consolidado.sql`
Faz: Desejo e Objetivo de dinheiro viram um só (`rede_wishlist_items`) e ganha o campo `prazo`.
- Já aplicada? `select column_name from information_schema.columns where table_name='rede_wishlist_items' and column_name='prazo';` Se voltar 1 linha, já está.
- Conferência depois: a mesma consulta devolve `prazo`. Se aparecer um aviso (NOTICE) sobre `rede_objetivos`, leia e me avise.

### 3. `0044_guardar_historico.sql`
Faz: cria a tabela `guardar_historico` (um registro por depósito guardado em um Desejo). Precisa da 0042 antes.
- Já aplicada? `select to_regclass('public.guardar_historico');` Se voltar o nome, já está.
- Conferência depois: `select policyname from pg_policies where tablename='guardar_historico';` deve listar 2 policies (dono lê, dono cria no próprio desejo).

### 4. `0045_ajustes_finais.sql`
Faz: cria 2 índices em `guardar_historico` (deixa as consultas rápidas). Precisa da 0044 antes.
- Conferência: o próprio arquivo termina com uma consulta que deve listar os 2 índices (`guardar_historico_user_data_idx` e `guardar_historico_desejo_data_idx`).

### Migrations que vierem depois nesta noite
Serão acrescentadas aqui, no fim, na ordem do número.

## Não aplicar

`supabase/migrations-descartadas/` guarda a 0041 (reação por emoji) e a 0043 (Bloquear horário). O capitão descartou as duas. Os números 0041 e 0043 ficam vagos de propósito; não renumerar as outras.
