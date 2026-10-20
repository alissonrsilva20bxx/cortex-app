# Antes de pedir teste ao dono

Rode no terminal, na pasta do projeto:

```
npm run pre-teste
```

Isso roda o typecheck, o lint e todos os testes (`vitest run`). Só peça teste se ficar tudo verde.

Atenção: os testes de `tests/rede/` (RLS, concorrência, integração) precisam de um Supabase de teste (`SUPABASE_TEST_URL`, ver `docs/rede/TEST_HARNESS.md`). Sem isso eles falham por falta de configuração, não por bug.

## Roteiro manual com CONTA NOVA

Use uma conta criada agora, sem nenhum dado antigo. Conta velha esconde bug.

1. **Agendar:** crie um atendimento na Agenda, com valor.
2. **Concluir:** abra o atendimento e toque em "Marcar como concluído".
3. **Financeiro:** o valor aparece nas Entradas e na meta, sem fechar o app.
4. **Widget do Início:** o card de meta e o faturamento andam.
5. **Jornada:** o passo e as missões do mês andam. Confira também as de "planejar" e "descanso" (hoje não andam: lacuna conhecida).

## O que os testes automáticos provam e o que NÃO provam

Provam que o código tem a estrutura certa (botão com ação, sem dado de exemplo em produção, todo valor lido tem quem escreva); NÃO provam que o fluxo funciona no iPhone: só o roteiro acima, feito por uma pessoa, prova.

As checagens estão em `tests/wiring/`: `botoes-com-acao`, `sem-dados-de-exemplo-em-producao` e `quem-escreve-o-que-le`. Cada uma tem um arquivo `.baseline.json` com o que já existia; ao consertar um item, tire a linha da baseline.
