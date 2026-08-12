import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T6 follow-up — resolveGateAuth() is the single place both Gate routes
 * (solicitar-beta, convites) ask "who is calling, and can we even reach
 * the backend". It folds the real cookie session (production, any real
 * login) and the /dev-preview/** bearer-token session (lib/devPreview/
 * session.ts) into one discriminated result, so routes never special-case
 * dev-preview and never confuse "no session" with "backend unreachable".
 */

const mocks = vi.hoisted(() => ({
  cookieCreateClient: vi.fn(),
  supabaseJsCreateClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/supabase-server", () => ({
  createClient: mocks.cookieCreateClient,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.supabaseJsCreateClient,
}));

import { resolveGateAuth } from "../../lib/devPreview/serverAuth";
import { DEV_PREVIEW_SESSION_HEADER } from "../../lib/devPreview/session";

function request(headers?: Record<string, string>) {
  return new Request("http://localhost/api/rede/convites", {
    method: "POST",
    headers,
  }) as never;
}

function cookieClient(getUserImpl: () => Promise<unknown>) {
  return { auth: { getUser: vi.fn(getUserImpl) } };
}

describe("resolveGateAuth — no dev-preview header (real cookie session, any environment)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
  });

  it("authenticates via the real cookie client when a user is present", async () => {
    const client = cookieClient(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    }));
    mocks.cookieCreateClient.mockReturnValue(client);

    const result = await resolveGateAuth(request());

    expect(result).toEqual({
      kind: "authenticated",
      supabase: client,
      userId: "user-1",
    });
    expect(mocks.supabaseJsCreateClient).not.toHaveBeenCalled();
  });

  it("reports unauthenticated when the cookie session has no user", async () => {
    const client = cookieClient(async () => ({
      data: { user: null },
      error: null,
    }));
    mocks.cookieCreateClient.mockReturnValue(client);

    const result = await resolveGateAuth(request());

    expect(result).toEqual({ kind: "unauthenticated" });
  });

  it("reports unavailable (not unauthenticated) when the real Supabase call throws", async () => {
    const client = cookieClient(async () => {
      throw new Error("ECONNREFUSED");
    });
    mocks.cookieCreateClient.mockReturnValue(client);

    const result = await resolveGateAuth(request());

    expect(result.kind).toBe("unavailable");
    expect((result as { message: string }).message).toMatch(/indisponível/i);
  });
});

describe("resolveGateAuth — dev-preview header present", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "local-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is ignored entirely in production — falls back to the cookie client", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const client = cookieClient(async () => ({
      data: { user: { id: "user-prod" } },
      error: null,
    }));
    mocks.cookieCreateClient.mockReturnValue(client);

    const result = await resolveGateAuth(
      request({ [DEV_PREVIEW_SESSION_HEADER]: "some-jwt" })
    );

    expect(result).toEqual({
      kind: "authenticated",
      supabase: client,
      userId: "user-prod",
    });
    expect(mocks.supabaseJsCreateClient).not.toHaveBeenCalled();
  });

  it("reports unavailable with an honest reason when local test env vars aren't configured", async () => {
    vi.stubEnv("SUPABASE_TEST_URL", "");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "");

    const result = await resolveGateAuth(
      request({ [DEV_PREVIEW_SESSION_HEADER]: "some-jwt" })
    );

    expect(result.kind).toBe("unavailable");
    expect((result as { message: string }).message).toMatch(
      /não configurado/i
    );
    expect(mocks.cookieCreateClient).not.toHaveBeenCalled();
  });

  it("reports unauthenticated when the token doesn't verify against the local instance", async () => {
    mocks.supabaseJsCreateClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: "invalid token" },
        })),
      },
    });

    const result = await resolveGateAuth(
      request({ [DEV_PREVIEW_SESSION_HEADER]: "garbage-token" })
    );

    expect(result).toEqual({ kind: "unauthenticated" });
  });

  it("reports unavailable when the local Supabase instance is unreachable", async () => {
    mocks.supabaseJsCreateClient.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }),
      },
    });

    const result = await resolveGateAuth(
      request({ [DEV_PREVIEW_SESSION_HEADER]: "some-jwt" })
    );

    expect(result.kind).toBe("unavailable");
    expect((result as { message: string }).message).toMatch(
      /local de teste/i
    );
  });

  it("authenticates with a client carrying the bearer token, once the token verifies", async () => {
    const probeClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "dev-preview-user" } },
          error: null,
        })),
      },
    };
    const authedClient = { auth: {}, marker: "authed" };
    mocks.supabaseJsCreateClient
      .mockReturnValueOnce(probeClient)
      .mockReturnValueOnce(authedClient);

    const result = await resolveGateAuth(
      request({ [DEV_PREVIEW_SESSION_HEADER]: "real-jwt" })
    );

    expect(result).toEqual({
      kind: "authenticated",
      supabase: authedClient,
      userId: "dev-preview-user",
    });
    expect(probeClient.auth.getUser).toHaveBeenCalledWith("real-jwt");
    // Second construction must carry the token so RLS runs as this user.
    expect(mocks.supabaseJsCreateClient).toHaveBeenLastCalledWith(
      "http://127.0.0.1:54321",
      "local-anon-key",
      expect.objectContaining({
        global: {
          headers: { Authorization: "Bearer real-jwt" },
        },
      })
    );
    // Never the app's real Supabase URL/key.
    expect(mocks.supabaseJsCreateClient).not.toHaveBeenCalledWith(
      expect.stringContaining("127.0.0.1:9"),
      expect.anything(),
      expect.anything()
    );
  });
});
