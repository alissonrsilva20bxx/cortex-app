import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

/**
 * T6 follow-up — ensureDevPreviewSession() provisions the one disposable,
 * fully fictitious local test account /dev-preview/app signs in as, so
 * the Gate's real endpoints have a genuine Supabase Auth session to
 * validate (never a hardcoded/faked result). Uses the SAME
 * SUPABASE_TEST_* env vars as the existing RLS/concurrency test harness
 * (tests/rede/support/env.ts) — never the app's real
 * NEXT_PUBLIC_SUPABASE_URL, never a remote project.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import { ensureDevPreviewSession } from "../../lib/devPreview/testUser";

function adminClient(overrides?: {
  listUsers?: Mock;
  createUser?: Mock;
  updateUserById?: Mock;
}) {
  return {
    auth: {
      admin: {
        listUsers:
          overrides?.listUsers ??
          vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        createUser:
          overrides?.createUser ??
          vi.fn().mockResolvedValue({
            data: { user: { id: "new-user-id" } },
            error: null,
          }),
        updateUserById:
          overrides?.updateUserById ??
          vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}

function anonClient(signInImpl?: () => Promise<unknown>) {
  return {
    auth: {
      signInWithPassword:
        signInImpl ??
        vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "fresh-access-token" },
            user: { id: "new-user-id" },
          },
          error: null,
        }),
    },
  };
}

describe("ensureDevPreviewSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "local-anon-key");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "local-service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unavailable when local test env vars aren't configured", async () => {
    vi.stubEnv("SUPABASE_TEST_URL", "");

    const result = await ensureDevPreviewSession();

    expect(result.kind).toBe("unavailable");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("creates the fixture user when it doesn't exist yet, then signs in", async () => {
    const admin = adminClient();
    const anon = anonClient();
    mocks.createClient
      .mockReturnValueOnce(admin) // admin client
      .mockReturnValueOnce(anon); // anon client for sign-in

    const result = await ensureDevPreviewSession();

    expect(result).toEqual({
      kind: "ok",
      accessToken: "fresh-access-token",
      userId: "new-user-id",
    });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email_confirm: true })
    );
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("reuses the existing fixture user (resets its password) instead of creating a duplicate", async () => {
    const admin = adminClient({
      listUsers: vi.fn().mockResolvedValue({
        data: {
          users: [{ id: "existing-user-id", email: "dev-preview-gate@example.test" }],
        },
        error: null,
      }),
    });
    const anon = anonClient();
    mocks.createClient.mockReturnValueOnce(admin).mockReturnValueOnce(anon);

    const result = await ensureDevPreviewSession();

    expect(result.kind).toBe("ok");
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "existing-user-id",
      expect.objectContaining({ password: expect.any(String) })
    );
  });

  it("only ever uses fictitious local data — a fixed @example.test address, never a real email", async () => {
    const admin = adminClient();
    const anon = anonClient();
    mocks.createClient.mockReturnValueOnce(admin).mockReturnValueOnce(anon);

    await ensureDevPreviewSession();

    const [createArgs] = admin.auth.admin.createUser.mock.calls[0] as [
      { email: string },
    ];
    expect(createArgs.email).toMatch(/@example\.test$/);
  });

  it("reports unavailable (not a thrown exception) when the local Supabase instance is unreachable", async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error("ECONNREFUSED");
    });

    const result = await ensureDevPreviewSession();

    expect(result.kind).toBe("unavailable");
  });

  it("reports unavailable when sign-in fails after provisioning", async () => {
    const admin = adminClient();
    const anon = anonClient(
      vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: { message: "invalid credentials" },
      })
    );
    mocks.createClient.mockReturnValueOnce(admin).mockReturnValueOnce(anon);

    const result = await ensureDevPreviewSession();

    expect(result.kind).toBe("unavailable");
  });
});
