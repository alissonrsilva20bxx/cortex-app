import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * T6 follow-up — /dev-preview/app's Rede gate always failed to validate a
 * real code because it has no real Supabase Auth cookie: middleware
 * redirected /api/rede/solicitar-beta and /api/rede/convites to /login
 * (307), and fetch() silently followed the redirect, so the gate's
 * `res.json()` choked on the login page's HTML and showed a generic
 * error. Confirmed against the live dev server before this fix (curl -i
 * POST on both routes returned "307 -> /login").
 *
 * This test proves the narrow bypass added to middleware.ts: only the two
 * exact Gate paths, only outside production, only with the dev-preview
 * session header present — every other path/condition keeps redirecting
 * unauthenticated requests exactly as before.
 */

function requestTo(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers,
  });
}

// middleware.ts always constructs a real Supabase client, even on paths
// this test doesn't expect to authenticate — same placeholder values
// documented for this worktree (never real Supabase, no network reachable
// at this host:port).
function stubPlaceholderSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-anon-key-not-a-real-secret"
  );
}

describe("middleware — dev-preview session bypass is narrowly scoped", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a Gate request through when the dev-preview header is present outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } = await import(
      "../../lib/devPreview/session"
    );

    const response = await middleware(
      requestTo("/api/rede/solicitar-beta", {
        [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value",
      })
    );

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still redirects the same Gate path to /login when the header is absent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");

    const response = await middleware(requestTo("/api/rede/convites"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("still redirects an unrelated route even with the header present (no blanket bypass)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } = await import(
      "../../lib/devPreview/session"
    );

    const response = await middleware(
      requestTo("/financeiro", {
        [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value",
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("still redirects the other real API routes even with the header present (only the 2 Gate paths qualify)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } = await import(
      "../../lib/devPreview/session"
    );

    const response = await middleware(
      requestTo("/api/jobs", {
        [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value",
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("the bypass is inert in production even with the correct path + header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } = await import(
      "../../lib/devPreview/session"
    );

    const response = await middleware(
      requestTo("/api/rede/convites", {
        [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value",
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});

describe("middleware — dev-preview page routes remain public as before (unchanged)", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("/dev-preview/app itself is never redirected", async () => {
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/dev-preview/app"));
    expect(response.status).not.toBe(307);
  });
});

describe("middleware — dev-preview session bootstrap endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is public outside production (no header needed — it's how the header is obtained)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const response = await middleware(
      requestTo("/api/dev-preview/session")
    );
    expect(response.status).not.toBe(307);
  });

  it("is NOT public in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(
      requestTo("/api/dev-preview/session")
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
