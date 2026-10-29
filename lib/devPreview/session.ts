/**
 * Sessão de teste do /dev-preview/** (só fora de produção).
 *
 * Nasceu para o portão de código da Rede (solicitar-beta, convites), que
 * precisava de uma sessão real do Supabase local no laboratório. O portão
 * saiu (a Rede entra pelo teste grátis), e com ele a liberação no
 * middleware, o endpoint que criava a sessão e o remendo do fetch. Fica o
 * cabeçalho que `resolveGateAuth` (lib/devPreview/serverAuth.ts) ainda
 * aceita nas rotas que se autenticam sozinhas, conferido contra
 * SUPABASE_TEST_URL e nunca em produção.
 */

export const DEV_PREVIEW_SESSION_HEADER = "x-jobapp-dev-preview-session";

export function isDevPreviewEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}
