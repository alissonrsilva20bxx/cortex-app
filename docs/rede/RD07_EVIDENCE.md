# RD-07 — Evidência local revisada

**Data:** 2026-07-26
**Base:** `28fb3ac`
**Origem incorporada:** Letícia `10d7838`
**Ambiente:** Supabase local descartável `cortex-rd07-local`
**Remoto:** Supabase remoto, secrets e deploy não acessados

## Correções

- validação polimórfica consulta a tabela correspondente e rejeita UUID ausente
  ou tipo incompatível;
- post e comentário precisam estar visíveis ao denunciante;
- mensagem só é denunciável por participante da conversa enquanto ela não está
  bloqueada;
- fixtures usam posts, comentários, usuários, conversas e mensagens reais;
- auditoria separa revisão e resolução, cada uma com timestamp, FK viva e
  snapshot UUID imutável;
- `ON DELETE SET NULL` remove somente a FK viva e preserva snapshot/timestamp,
  sem impedir a exclusão do admin;
- transições permitidas: pendente→revisada, pendente→resolvida e
  revisada→resolvida; resolvida é terminal;
- campos originais e auditoria anterior não podem ser sobrescritos;
- grants autenticados são somente SELECT, colunas de INSERT do denunciante e
  colunas explícitas de transição para admin; sem DELETE;
- anon, não membro e não admin permanecem negados.

## Validação

Após reset limpo e duas reaplicações no mesmo schema:

```text
Test Files 1 passed
Tests 15 passed

tsc --noEmit

Test Files 7 passed
Tests 93 passed
```

O catálogo confirmou para `authenticated`: `SELECT` da tabela, `INSERT` apenas
em `denunciante_id/alvo_tipo/alvo_id/motivo/descricao` e `UPDATE` apenas em
status e campos explícitos de auditoria. Não há `DELETE`, nem grant para `anon`.
O banco terminou com zero usuários `rede-test-%` e convites `rd07-member-%`.
