# RD-04 — Evidência local

**Data:** 2026-07-26
**Ambiente:** Supabase local descartável `cortex-rd04-local`
**Produção/remoto:** não acessados

## Ciclos TDD

### Vermelho 1 — tabelas ausentes

Antes da migration, o teste focado falhou no setup com:

```text
Could not find the table 'public.rede_amizades' in the schema cache
Test Files 1 failed
Tests 14 skipped
```

### Verde 1 — comportamento do grafo social

Após criar `0008_rede_social_graph.sql`:

```text
Test Files 1 passed
Tests 14 passed
```

### Vermelho 2 — grants estruturais amplos

Os testes adicionais provaram que o primeiro desenho ainda permitia editar
campos estruturais de amizade e linhas imutáveis de bloqueio:

```text
Tests 3 failed | 11 passed
```

O grant foi então reduzido: usuários autenticados só atualizam `status` e
`respondido_em` em amizades, e não têm `UPDATE` em bloqueios.

### Vermelho 3 — consentimento e membership

Testes adversariais adicionais mostraram que o solicitante ainda conseguia
aceitar a própria solicitação e criar uma amizade já aceita. As policies foram
então restringidas para:

- permitir `INSERT` somente pendente, sem `respondido_em`;
- permitir a resposta somente pelo destinatário;
- exigir membership em todas as operações do grafo.

### Vermelho 4 — resposta terminal mutável

O teste adversarial final demonstrou que uma amizade aceita ainda podia ser
recusada ou reaberta depois, e que `respondido_em` podia ser preenchido sem uma
resposta terminal:

```text
Tests 1 failed | 17 passed
```

Um trigger passou a aceitar exatamente uma transição de `pendente` para
`aceita` ou `recusada`, sempre com `respondido_em` preenchido.

### Verde final

```text
tsc --noEmit
Test Files 4 passed
Tests 46 passed
```

O arquivo focado de RD-04 terminou com `18 passed`, inclusive depois de
reaplicar a migration duas vezes.

## Schema e segurança confirmados

- RLS habilitada em `rede_amizades` e `rede_bloqueios`.
- Sete policies autenticadas:
  - amizades: `SELECT` e `DELETE` para qualquer ponta, `INSERT` só pelo
    solicitante e `UPDATE` só pelo destinatário;
  - bloqueios: `SELECT`, `INSERT` e `DELETE` somente pelo bloqueador.
- Todas as policies também exigem convite resgatado via `rede_is_member()`;
  usuário Auth sem convite não participa do grafo.
- `anon` não tem privilégio nas duas tabelas.
- `authenticated`:
  - amizades: `SELECT`, `INSERT`, `DELETE` e `UPDATE` somente nas colunas
    `status` e `respondido_em`;
  - bloqueios: `SELECT`, `INSERT`, `DELETE`, sem `UPDATE`.
- `service_role` mantém CRUD para fluxos server-side e fixtures.
- O índice unique `rede_amizades_par_unico_idx` usa
  `least(solicitante_id, destinatario_id)` e
  `greatest(solicitante_id, destinatario_id)`.
- Duplicata no sentido inverso retorna `23505`.
- Autoamizade, autobloqueio e bloco duplicado são rejeitados.
- Após a suíte: zero usuários `rede-test-%@example.test`.
- A migration foi reexecutada duas vezes sem erro.
