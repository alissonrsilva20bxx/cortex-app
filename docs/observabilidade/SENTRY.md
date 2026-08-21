# Observabilidade — Sentry (T19/#72)

Decisão de produto confirmada em 2026-08-20 (comentário na issue #72):
ferramenta de error tracking = **Sentry**.

## Estado atual

O SDK (`@sentry/nextjs`) está instalado e configurado
(`sentry.client.config.ts`, `sentry.server.config.ts`,
`sentry.edge.config.ts`, `instrumentation.ts`, `app/global-error.tsx`,
`next.config.mjs`). **Sem `NEXT_PUBLIC_SENTRY_DSN` definido, tudo isso é
um no-op seguro** — nenhum dado sai do app, `Sentry.init` simplesmente
não tem pra onde mandar nada. Nenhum ambiente hoje (local, CI, produção)
tem esse valor configurado.

Verificado localmente (`debug: true` temporário, revertido antes do
commit): com um DSN válido de formato mas fictício, os handlers globais
(`onerror`/`onunhandledrejection`) instalam corretamente e o SDK captura
de fato erros reais do app (confirmado com um erro de hydration
pré-existente, não relacionado a este ticket). Isso é o mais próximo de
"testado localmente" que dá pra chegar sem uma conta Sentry de verdade —
ver critério de aceite #2 da issue, que pede o erro aparecendo no painel
do provedor, algo que só um projeto Sentry real permite confirmar.

## O que falta — precisa de ação humana

1. **Criar (ou apontar) uma organização/projeto no sentry.io** para o
   JobApp.
2. **Definir `NEXT_PUBLIC_SENTRY_DSN`** no ambiente de deploy (Vercel ou
   equivalente) — é um valor público por design do Sentry (não é
   secreto), mas mesmo assim não deve ser hardcoded no código: só via
   variável de ambiente.
3. Opcional, só se quiser sourcemaps legíveis no Sentry: `SENTRY_ORG`,
   `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (este sim é secreto — nunca
   commitar, nunca logar). Sem isso, `next.config.mjs` já desliga upload
   de sourcemap automaticamente (`sourcemaps.disable: !SENTRY_AUTH_TOKEN`)
   — o app funciona normalmente, só os stack traces no Sentry vêm
   minificados.
4. Depois de definir o DSN, testar de novo em produção/preview: disparar
   um erro real (ex.: um botão de teste temporário que chama
   `throw new Error("teste sentry")`) e confirmar que aparece no painel.

## Política de coleta (critério de aceite #4)

- `tracesSampleRate: 0` — sem performance monitoring.
- Sem `browserTracingIntegration`/`replayIntegration` adicionadas
  manualmente — nunca adicionar essas duas sem uma nova decisão de
  produto explícita, é exatamente o tipo de telemetria de comportamento
  que este ticket pede pra não coletar.
- `sendDefaultPii: false` — sem IP, cookies, corpo de request/response.
- Só as integrações padrão do SDK (captura global de exceção/rejeição
  não tratada, breadcrumbs, dedupe) — isso já cobre "captura de
  exceções não tratadas" (escopo item 1 da issue).

## Canal de feedback estruturado das testadoras (critério de aceite #3)

**Ainda não decidido — precisa de decisão humana**, registrado como
comentário na issue #72. Não implementei nenhum canal específico (link
de formulário, e-mail, etc.) porque inventar uma URL/processo sem
confirmação real seria pior do que deixar em aberto. Opções mais simples
pra decidir, sem exigir nova infra:
- Um link `mailto:` fixo pra alguém do time, exposto em Ajustes.
- Um formulário externo (Google Forms/Typeform) — precisa da URL real.
- Um campo de texto simples dentro do app que grava na tabela `notas`
  já existente (RLS por owner) — não expõe like "roadmap" nem prioriza,
  só junta o texto num lugar consultável.

Qualquer uma dessas é implementável rápido assim que a decisão vier.
