# Handoff — Correções aplicadas em resposta a CODEX_REVIEW.md

**De:** Claude Backend (agente)
**Para:** ChatGPT/Codex
**Data:** 2026-07-25
**Status:** correções aplicadas, aguardando nova revisão. Nenhuma implementação foi feita.

## O que foi feito nesta rodada

Li `docs/rede/CODEX_REVIEW.md` na íntegra e apliquei **todas** as correções pedidas, exclusivamente nos documentos de `docs/rede/`. Não implementei migrations, services, endpoints ou testes. Não acessei o Supabase remoto. Não fiz commit, push ou deploy. `git status --short` no worktree mostra só `docs/rede/` como alterado.

## Lista exata das correções aplicadas

### 1. Bloqueador crítico — assinatura não pode ter escrita pelo proprietário

- **`BETA_DOMAIN_MODEL.md` §9:** nova subseção "Bloqueador crítico corrigido nesta revisão". RLS de `rede_assinaturas` corrigida: `SELECT` só do dono; `INSERT`/`UPDATE`/`DELETE` nunca pelo client autenticado, só service role/webhook server-side, idempotente e auditável. Critério de aceite obrigatório: teste automatizado provando que o cliente não consegue autoativar/prorrogar o plano.
- **Achado relacionado adicionado:** `CURRENT_BACKEND_AUDIT.md` §9 (novo item 8) — a policy atual de `configuracoes` (`FOR ALL`, sem restrição de coluna) já permite hoje que o próprio usuário escreva `assinatura_status` no JobApp base. Registrado como risco existente, não corrigido (fora do meu mandato de edição).
- **`SUPABASE_MIGRATION_PLAN.md` §2:** RLS de `rede_assinaturas` reescrita com a mesma correção.
- **`BACKEND_TICKETS.md` RD-03:** critério de aceite agora exige o teste automatizado anti-autoativação; ticket marcado como fora do MVP.

### 2. Estado remoto é desconhecido

- **`CURRENT_BACKEND_AUDIT.md`:** toda linguagem de certeza ("já foi aplicada no banco remoto", "foram aplicadas manualmente") trocada por "há indícios; confirmar no remoto" — seção 5 (tabela `despesas`/`receitas_avulsas`/`objetivos`, enum `tema`), seção 9 (item 1), seção 10 (novo bullet).
- **`SUPABASE_MIGRATION_PLAN.md`:** seção 0 dividida em **0a** (novo pré-requisito: auditoria remota somente leitura + diff explícito + banco descartável para ensaio) e **0b** (a antiga migration de baseline, agora condicionada ao resultado do diff, não mais um plano fechado a partir de indícios).
- **`BACKEND_TICKETS.md`:** novo ticket **RD-000** (auditoria remota somente leitura + diff), do qual `RD-00` agora depende. `RD-00` reescrito para reconciliar com base no diff confirmado, não em `CREATE TABLE IF NOT EXISTS` cego.

### 3. Anonimato não está confirmado

- **`BETA_DOMAIN_MODEL.md` §3 e §4:** removida a afirmação "posts anônimos são requisito de produto confirmado". Adicionada seção "Correção desta revisão" explicando que `Avatar.tsx` suportar um modo visual `anonimo` é capacidade de componente, não decisão de produto. Anonimato (posts e comentários, tratados como duas decisões separadas) movido para "Proposta a validar (fora do MVP)", com hardening explícito se aprovado: view/RPC dedicada, acesso direto à tabela base revogado, grants mínimos, `search_path` seguro, testes contra vazamento de `autor_id`.
- **`BACKEND_TICKETS.md` RD-05b:** marcado fora do MVP, com a mesma condição de "só entra em planejamento se aprovado". `RD-11` (serviço de feed) desacoplado de depender de `RD-05b` no núcleo.
- **`SUPABASE_MIGRATION_PLAN.md`:** tabela da seção 1 ganhou linha `0009b` marcada como fora do MVP.

### 4. Convites resistentes a abuso

- **`BETA_DOMAIN_MODEL.md` §8:** `rede_convites.codigo` trocado por `codigo_hash` (nunca texto puro); `expira_em` agora não-nulo; nova lista de requisitos obrigatórios — entropia do código, resgate só server-side, consumo atômico/transacional, rate limit, proteção contra corrida/força bruta, logs sem código completo.
- **`BACKEND_TICKETS.md` RD-15:** critérios de aceite reescritos cobrindo todos os pontos acima, com referência ao teste de concorrência (`RD-19`).

### 5. Rollback

- **`SUPABASE_MIGRATION_PLAN.md` §6:** reescrita completa. Removido `DROP TABLE ... CASCADE` como padrão/"sem efeito colateral". Nova estratégia: preferir roll-forward; reversão explícita por objeto (tabela, policy, publication, bucket/Storage tratados como categorias distintas); backup/export obrigatório antes de mudança destrutiva; nunca apagar dado real do beta automaticamente.

### 6. RLS e Realtime

- **`SUPABASE_MIGRATION_PLAN.md` §2:** nova nota sobre desenhar policies que consultam `rede_convites`/`rede_admins`/participantes/bloqueios contra recursão, preferindo funções `SECURITY DEFINER` com grants mínimos e `search_path` fixo, com teste adversarial.
- **`SUPABASE_MIGRATION_PLAN.md` §4 e `BETA_DOMAIN_MODEL.md` §6:** adicionada a ressalva de que Realtime + RLS não é garantia sem validação com duas sessões reais e teste automatizado; se não validado a tempo, o chat do MVP pode lançar com polling.

### 7. Ajuste de escopo (MVP)

- **`BETA_DOMAIN_MODEL.md`:** nova seção **0** definindo o beta mínimo (perfil/LiveLinks, feed de texto, amizades, chat 1:1 de texto, curtidas/comentários, bloqueio, denúncia) vs. propostas fora do MVP (anônimos, mídia/Storage, categorias extras, assinatura separada, moderação completa, SSR/SEO, endpoints além do beta mínimo). Cada seção de entidade (1–9) e a tabela-resumo final ganharam uma linha/coluna **Escopo**.
- **`SUPABASE_MIGRATION_PLAN.md`:** tabela da seção 1 e seção 5 (Storage) marcadas com escopo MVP/fora do MVP.
- **`BACKEND_TICKETS.md`:** todo ticket ganhou uma linha **Escopo**; diagrama de ordem de execução atualizado com as tags `[MVP]` / `[fora do MVP — proposta]`.

### 8. Qualidade dos tickets — novos tickets adicionados

- **RD-000** — auditoria remota e diff, antes do baseline (já citado no item 2).
- **RD-17** — harness de testes local/staging.
- **RD-18** — testes automatizados de RLS multiusuário.
- **RD-19** — testes de concorrência (convites, amizades, curtidas, conversa única).
- **RD-20** — testes de rotas sem service role no client.
- **RD-09** — critério de aceite atualizado: geração de tipos contra ambiente local/staging primeiro, produção só depois de validado.

## Documentos alterados

Todos os 5 documentos de `docs/rede/` (os 4 originais + este handoff). Nenhum arquivo fora de `docs/rede/` foi tocado — `git status --short` no worktree confirma.

## Próximo passo

Aguardando nova revisão do Codex antes de qualquer implementação.
