/**
 * Shared contract for the /dev-preview/** test session (T6 follow-up —
 * dev-preview's Rede gate couldn't validate a real invite code because it
 * has no real Supabase Auth cookie, so the two Gate endpoints always hit
 * middleware's redirect-to-/login and choked parsing the login page as
 * JSON). This lets /dev-preview/app carry a real local-Supabase session
 * to exactly those two endpoints, without ever touching real auth.
 *
 * Isolation is enforced by three independent conditions, all required:
 *   1. `isDevPreviewEnvironment()` — false whenever NODE_ENV === "production",
 *      so this is inert in any real deployment regardless of what a request
 *      sends.
 *   2. `isDevPreviewGatePath()` — only these two exact pathnames, never a
 *      prefix match, never any other route.
 *   3. The header itself must carry a real Supabase Auth JWT for the LOCAL
 *      test project (verified server-side in lib/devPreview/serverAuth.ts
 *      against SUPABASE_TEST_URL, never the app's real
 *      NEXT_PUBLIC_SUPABASE_URL) — a garbage/forged value authenticates as
 *      nobody, same as having no session at all.
 */

export const DEV_PREVIEW_SESSION_HEADER = "x-jobapp-dev-preview-session";

export const DEV_PREVIEW_GATE_PATHS = [
  "/api/rede/solicitar-beta",
  "/api/rede/convites",
] as const;

/**
 * Bootstrap endpoint the dev-preview page calls to obtain the bearer token
 * in the first place — can't require the token itself (chicken-and-egg),
 * so it's public instead, but only ever outside production.
 */
export const DEV_PREVIEW_SESSION_BOOTSTRAP_PATH = "/api/dev-preview/session";

export function isDevPreviewEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isDevPreviewGatePath(pathname: string): boolean {
  return (DEV_PREVIEW_GATE_PATHS as readonly string[]).includes(pathname);
}

export function isDevPreviewSessionBootstrapPath(pathname: string): boolean {
  return pathname === DEV_PREVIEW_SESSION_BOOTSTRAP_PATH;
}
