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

### 5. `0046_jobs_trava_status.sql`
Faz: trava no banco para o status do atendimento. A usuária, mesmo chamando a API direto, só grava o que a tela já deixa (ex.: não conclui atendimento da semana que vem, não confirma depois do horário). Não depende das outras; não muda nenhuma linha que já existe. Tem folga de fuso (até 15 horas), então nunca bloqueia o que a tela faz.
- Já aplicada? `select tgname from pg_trigger where tgrelid = 'public.jobs'::regclass and tgname = 'jobs_status_no_fluxo';` Se voltar 1 linha, já está.
- Conferência depois: a mesma consulta devolve 1 linha. Depois, no app, concluir um atendimento que já passou deve funcionar normal.
- Se der problema: o próprio arquivo tem o `drop trigger` / `drop function` para desfazer.

### 6. `0047_jornada_dica_curtida.sql`
Faz: a curtida numa publicação da categoria Dica passa a contar como "Sua dica ajudou alguém" para a autora (+5 de brilho no Conectar, até 5 por dia). Destrava a missão "Sua dica ajudar 3 vezes" (dezembro, março, junho e setembro) e o selo Mão amiga, que hoje ficam parados em 0. Curtir a própria dica não conta; cada pessoa conta uma vez por dica, mesmo se descurtir e curtir de novo; curtidas antigas não contam. Se o crédito falhar, a curtida grava igual. Precisa só da 0009 e da 0035 (já usadas pelo app). **Muda o que a usuária ganha:** aplique só se concordar que curtida em dica = "ajudou".
- Já aplicada? `select tgname from pg_trigger where tgrelid = 'public.rede_curtidas'::regclass and tgname = 'rede_curtidas_credita_dica';` Se voltar 1 linha, já está.
- Conferência depois: a mesma consulta devolve 1 linha, e `select to_regclass('private.jornada_dica_creditos');` devolve o nome.
- Se der problema: o próprio arquivo tem o `drop trigger` / `drop function` / `drop table` para desfazer.

### Migrations que vierem depois nesta noite
Serão acrescentadas aqui, no fim, na ordem do número.

## Não aplicar

`supabase/migrations-descartadas/` guarda a 0041 (reação por emoji) e a 0043 (Bloquear horário). O capitão descartou as duas. Os números 0041 e 0043 ficam vagos de propósito; não renumerar as outras.
