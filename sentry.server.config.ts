import * as Sentry from "@sentry/nextjs";

/**
 * T19/#72 — mesma política do client: só error tracking, sem DSN vira
 * no-op seguro. Ver sentry.client.config.ts.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
