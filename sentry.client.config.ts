import * as Sentry from "@sentry/nextjs";

/**
 * T19/#72 — só captura de erro, nada de telemetria de comportamento. Sem
 * DSN (nenhum ambiente local/dev tem um configurado hoje), `Sentry.init`
 * é um no-op seguro: não lança, não manda nada. Fica pronto pra ativar
 * assim que um humano provisionar um projeto Sentry real e definir
 * `NEXT_PUBLIC_SENTRY_DSN` (ver docs/observabilidade/SENTRY.md).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // As integrações padrão (captura global de exceção/rejeição não
  // tratada, breadcrumbs) já bastam — nunca adicionar
  // browserTracingIntegration/replayIntegration aqui, é exatamente a
  // telemetria de comportamento que este ticket pede pra não coletar.
  tracesSampleRate: 0,

  // IP, cookies, dados de request/response ficam de fora por padrão.
  sendDefaultPii: false,
});
