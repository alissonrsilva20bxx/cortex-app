import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEV_PREVIEW_SESSION_HEADER,
  isDevPreviewEnvironment,
  isDevPreviewGatePath,
  isDevPreviewSessionBootstrapPath,
} from "./lib/devPreview/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // /dev-preview/app has no real Supabase Auth cookie, so the Gate's two
  // real endpoints (solicitar-beta, convites) always hit the redirect
  // below and fetch() silently followed it to /login, breaking res.json()
  // client-side (T6 follow-up). Narrowly let those two exact paths
  // through — never a prefix match, never any other route — so the route
  // handler can authenticate the request itself via the dev-preview
  // bearer token (lib/devPreview/serverAuth.ts) instead. Inert whenever
  // NODE_ENV === "production", regardless of path or header, so this can
  // never affect a real deployment.
  if (
    isDevPreviewEnvironment() &&
    isDevPreviewGatePath(path) &&
    request.headers.get(DEV_PREVIEW_SESSION_HEADER)
  ) {
    return NextResponse.next({ request });
  }

  // /dev-preview/** serves a fully mocked Rede (fictional profiles, no real
  // Supabase) and used to be public unconditionally, regardless of
  // NODE_ENV. Same isDevPreviewEnvironment() signal already used for the
  // session-bootstrap endpoint below -- inert whenever NODE_ENV ===
  // "production", so this never affects local dev or preview deployments,
  // but blocks the mock surface entirely in production, before any auth
  // check runs.
  if (path.startsWith("/dev-preview") && !isDevPreviewEnvironment()) {
    return new NextResponse("Not found", { status: 404 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    path === "/login" ||
    path.startsWith("/auth") ||
    path.startsWith("/dev-preview") ||
    (isDevPreviewEnvironment() && isDevPreviewSessionBootstrapPath(path));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
