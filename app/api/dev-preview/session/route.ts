import "server-only";

import { NextResponse } from "next/server";

import { isDevPreviewEnvironment } from "../../../../lib/devPreview/session";
import { ensureDevPreviewSession } from "../../../../lib/devPreview/testUser";

export const runtime = "nodejs";

/**
 * Bootstrap endpoint /dev-preview/app calls once on mount to obtain the
 * bearer token it then attaches to the Gate's two real endpoints
 * (solicitar-beta, convites) — see lib/devPreview/session.ts and
 * middleware.ts for how that token is scoped. Public in middleware only
 * outside production; double-checks that here too so this 404s on its
 * own even if reached directly in a production deployment.
 */
export async function POST() {
  if (!isDevPreviewEnvironment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await ensureDevPreviewSession();
  if (result.kind === "unavailable") {
    return NextResponse.json({ error: result.message }, { status: 503 });
  }

  return NextResponse.json({ accessToken: result.accessToken });
}
