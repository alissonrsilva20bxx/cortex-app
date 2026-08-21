import * as Sentry from "@sentry/nextjs";

/**
 * T19/#72 — cobre o runtime edge (middleware.ts). Mesma política do
 * client/server: só error tracking, sem DSN vira no-op seguro.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
