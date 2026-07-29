# RD-05 — Evidência local revisada

**Data:** 2026-07-26
**Base:** `717cecc`
**Origem incorporada:** commit Letícia `1bc4a53`
**Ambiente:** Supabase local descartável `cortex-rd05-local`
**Remoto:** Supabase remoto, secrets e deploy não acessados

## TDD adversarial

A versão incorporada tinha seis falhas reproduzidas antes da correção:

- comentário de autor neutro vazava quando o post estava invisível;
- os dois lados de um bloqueio conseguiam comentar no post um do outro;
- era possível mover comentário para post invisível;
- curtidas de post invisível vazavam e ainda podiam ser criadas;
- `rede_bloqueio_mutuo(alvo)` era chamável como RPC e revelava a relação
  privada de bloqueio para um alvo arbitrário.

```text
Test Files 1 failed
Tests 6 failed | 15 passed
```

## Desenho final

- helpers `security definer` ficam no schema não exposto `private`, usam
  `search_path = ''` e objetos qualificados;
- o helper público antigo é removido somente depois da substituição das
  policies, permitindo reaplicação convergente no mesmo schema;
- post exige membership e ausência de bloqueio mútuo;
- comentário exige autor visível e post visível para leitura, inserção e
  atualização;
- `post_id` e `autor_id` do comentário não recebem grant de atualização;
- curtidas só aparecem e só podem ser criadas se o post for visível;
- curtidas também ocultam o `user_id` de quem está em bloqueio mútuo, nos dois
  sentidos, mesmo em post neutro;
- remoção da própria curtida continua possível sem revelar a linha por leitura;
- grants autenticados são limitados às colunas mutáveis necessárias;
- `anon` não recebe privilégios e não membro não lê/escreve conteúdo.

## Validação final

Após reset limpo e duas reaplicações no mesmo schema:

```text
Test Files 1 passed
Tests 23 passed

tsc --noEmit

Test Files 6 passed
Tests 78 passed
```

A inspeção final confirmou zero usuários `rede-test-%@example.test` e zero
convites `rd05-member-%`. A reaplicação foi realmente executada no mesmo schema;
os `NOTICE ... already exists` foram acompanhados de saída zero e nova suíte
verde, sem inferir idempotência apenas pelos avisos.
