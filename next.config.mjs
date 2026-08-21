import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        // Service worker must never be cached by the browser (has its own update mechanism)
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
    ];
  },
};

// T19/#72 — sem SENTRY_AUTH_TOKEN (nenhum ambiente local/dev tem um
// configurado hoje — precisa vir de um projeto Sentry real, provisionado
// por um humano), desliga upload de sourcemap: build local/CI continua
// idêntico a antes, sem tentar autenticar em lugar nenhum. Nunca commitar
// esse token — só via variável de ambiente do provedor de deploy.
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
