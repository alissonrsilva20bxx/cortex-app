# Antes de pedir teste ao dono

Rode no terminal, na pasta do projeto:

```
npm run pre-teste
```

Isso roda o typecheck, o lint e todos os testes (`vitest run`). Só peça teste se ficar tudo verde.

Os testes de `tests/rede/` (RLS, concorrência, integração) precisam de um Supabase local de teste (`SUPABASE_TEST_URL`, ver `docs/rede/TEST_HARNESS.md`). Sem a variável eles ficam de fora do `pre-teste` e aparecem como PULADO (1 teste "skipped" com a mensagem), não como falha. Pular não é provar: antes de mexer em RLS, migration ou serviço da Rede, rode:

```
npm run teste-banco
```

Esse comando exige `SUPABASE_TEST_URL` (no ambiente ou em `.env.test.local`) e roda só `tests/rede`. Sem a variável ele para com aviso.

## Roteiro manual com CONTA NOVA

Use uma conta criada agora, sem nenhum dado antigo. Conta velha esconde bug.

1. **Agendar:** crie um atendimento na Agenda, com valor.
2. **Concluir:** abra o atendimento e toque em "Marcar como concluído".
3. **Financeiro:** o valor aparece nas Entradas e na meta, sem fechar o app.
4. **Widget do Início:** o card de meta e o faturamento andam.
5. **Jornada:** o passo e as missões do mês andam. Confira também as de "planejar" e "descanso" (hoje não andam: lacuna conhecida).

## O que os testes automáticos provam e o que NÃO provam

Provam que o código tem a estrutura certa (botão com ação, sem dado de exemplo em produção, todo valor lido tem quem escreva); NÃO provam que o fluxo funciona no iPhone: só o roteiro acima, feito por uma pessoa, prova.

As checagens estão em `tests/wiring/`: `botoes-com-acao`, `sem-dados-de-exemplo-em-producao`, `quem-escreve-o-que-le` e `locale-moeda-em-constantes`. Cada uma tem um arquivo `.baseline.json` com o que já existia (a de locale e moeda é `locale-moeda.baseline.json`); ao consertar um item, tire a linha da baseline.
