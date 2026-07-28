import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/** Smallest possible valid PNG (1x1, transparent) -- avoids MIME-sniffing surprises. */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

/**
 * RD-08 acceptance criteria, proven end-to-end against a local Supabase:
 * upload only works under the caller's own user_id path segment; read works
 * for any Rede member, not just the file owner (unlike `cofre`, which is
 * signed-URL only -- see docs/rede/SUPABASE_MIGRATION_PLAN.md §5).
 */
describe("Storage: rede-midia (RD-08)", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;
  let otherMember: TestUser;
  let nonMember: TestUser;
  let ownerFilePath: string;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await redeClient(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: `rd08-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  beforeAll(async () => {
    owner = await createTestUser();
    testUsers.push(owner);
    otherMember = await createTestUser();
    testUsers.push(otherMember);
    nonMember = await createTestUser();
    testUsers.push(nonMember);

    await seedMembership(owner.id);
    await seedMembership(otherMember.id);
    // nonMember never redeems an invite.

    ownerFilePath = `${owner.id}/posts/test-post/pixel.png`;
  });

  afterAll(async () => {
    await redeClient(adminClient())
      .storage.from("rede-midia")
      .remove([ownerFilePath]);

    const results = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(
        `Failed to delete ${failures.length} local test user(s): ${failures
          .map((failure) => String(failure.reason))
          .join("; ")}`
      );
    }
  });

  it("lets a member upload under their own user_id path", async () => {
    const { error } = await redeClient(owner.client)
      .storage.from("rede-midia")
      .upload(ownerFilePath, ONE_PIXEL_PNG, { contentType: "image/png" });

    expect(error).toBeNull();
  });

  it("rejects an upload under another member's user_id path", async () => {
    const forgedPath = `${owner.id}/posts/forjado/pixel.png`;
    const { error } = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .upload(forgedPath, ONE_PIXEL_PNG, { contentType: "image/png" });

    expect(error).not.toBeNull();
  });

  it("rejects an upload from an authenticated non-member", async () => {
    const path = `${nonMember.id}/posts/x/pixel.png`;
    const { error } = await redeClient(nonMember.client)
      .storage.from("rede-midia")
      .upload(path, ONE_PIXEL_PNG, { contentType: "image/png" });

    expect(error).not.toBeNull();
  });

  it("lets any Rede member read a file that isn't theirs (unlike cofre)", async () => {
    const { data, error } = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .download(ownerFilePath);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.size).toBeGreaterThan(0);
  });

  it("denies read access to an authenticated non-member", async () => {
    const { error } = await redeClient(nonMember.client)
      .storage.from("rede-midia")
      .download(ownerFilePath);

    expect(error).not.toBeNull();
  });

  it("denies all access to anon", async () => {
    const download = await redeClient(anonClient())
      .storage.from("rede-midia")
      .download(ownerFilePath);
    const upload = await redeClient(anonClient())
      .storage.from("rede-midia")
      .upload(`${owner.id}/posts/anon/pixel.png`, ONE_PIXEL_PNG, {
        contentType: "image/png",
      });

    expect(download.error).not.toBeNull();
    expect(upload.error).not.toBeNull();
  });

  it("rejects another member deleting the owner's file", async () => {
    const { error, data } = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .remove([ownerFilePath]);

    // Storage remove() reports success with an empty result for paths RLS
    // hides rather than a hard error -- assert nothing was actually removed
    // by confirming the owner can still read it right after.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const stillThere = await redeClient(owner.client)
      .storage.from("rede-midia")
      .download(ownerFilePath);
    expect(stillThere.error).toBeNull();
  });

  it("lets the owner delete their own file", async () => {
    const { error, data } = await redeClient(owner.client)
      .storage.from("rede-midia")
      .remove([ownerFilePath]);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const gone = await redeClient(owner.client)
      .storage.from("rede-midia")
      .download(ownerFilePath);
    expect(gone.error).not.toBeNull();
  });

  it("rejects an upload past the 10 MB / image-only bucket limits", async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0);
    const path = `${owner.id}/posts/test-post/oversized.png`;
    const { error } = await redeClient(owner.client)
      .storage.from("rede-midia")
      .upload(path, oversized, { contentType: "image/png" });

    expect(error).not.toBeNull();

    const wrongType = `${owner.id}/posts/test-post/doc.pdf`;
    const { error: mimeError } = await redeClient(owner.client)
      .storage.from("rede-midia")
      .upload(wrongType, Buffer.from("not an image"), {
        contentType: "application/pdf",
      });

    expect(mimeError).not.toBeNull();
  });
});
