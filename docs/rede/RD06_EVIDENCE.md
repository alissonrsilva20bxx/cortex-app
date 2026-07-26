# RD-06 — Evidência local

**Data:** 2026-07-26
**Ambiente:** Supabase local descartável `cortex-rd06-local`
**Produção/remoto:** Supabase remoto, secrets e deploy não acessados

## TDD

Antes da migration, o teste focado falhou porque
`rede_criar_conversa_1a1` não existia no schema cache. Depois da implementação,
os seis testes iniciais passaram.

O teste Realtime foi executado com clientes autenticados distintos. Na primeira
execução imediatamente após o cold start, o canal assinou mas o listener WAL
local ainda não entregou o evento dentro do prazo. A repetição após a
inicialização da replicação passou. O teste ganhou uma janela curta e limitada
após `SUBSCRIBED`, preservando timeout explícito; o resultado final é registrado
abaixo após novo reset completo.

Uma revisão adversarial adicionou dois casos vermelhos: o destinatário não
conseguia marcar a mensagem como lida e uma corrida entre bloqueio e criação de
conversa não tinha uma ordem transacional comum. O desenho final concede apenas
`UPDATE (lida_em)`, permite uma única marcação pelo outro participante e usa o
mesmo advisory lock transacional canônico no trigger de bloqueio e na função de
criação. As policies também ocultam a conversa e as mensagens depois do
bloqueio.

## Garantias verificadas

- conversa 1:1 canônica e única para o mesmo par, independentemente da ordem;
- criação atômica via função `security definer`, com `search_path` vazio;
- auto-conversa, não membro e par bloqueado rejeitados;
- mutação direta de conversas e participantes não concedida ao client;
- helpers de participação evitam recursão de RLS e têm `EXECUTE` mínimo;
- participantes leem conversa, participantes e mensagens;
- somente participante autenticado insere mensagem em seu próprio nome;
- outsider e `anon` não leem nem escrevem;
- texto vazio rejeitado;
- somente `rede_mensagens` integra a publication `supabase_realtime`;
- duas sessões participantes/outsider confirmam que apenas o participante
  recebe o evento de `INSERT`.

## Validação final

Após reset limpo e reaplicação da migration duas vezes:

```text
Test Files 1 passed
Tests 9 passed

tsc --noEmit

Test Files 5 passed
Tests 55 passed
```

O banco terminou sem usuários `rede-test-%@example.test` nem convites
`rd06-member-%`.
