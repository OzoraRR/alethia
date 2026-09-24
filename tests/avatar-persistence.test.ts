import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadAvatar, uploadAvatar } from "../features/profile/avatar-persistence";
import { safeRemoveItem, STORAGE_KEYS } from "../lib/storage/safe-storage";

describe("Avatar Persistence Layer", () => {
  beforeEach(() => {
    safeRemoveItem(STORAGE_KEYS.AVATAR);
  });

  test("loads null when no avatar is stored and no session exists", async () => {
    const result = await loadAvatar();
    assert.equal(result.avatarUrl, null);
    assert.equal(result.error, null);
  });

  test("rejects invalid file types", async () => {
    const fakeFile = new File(["dummy content"], "test.txt", { type: "text/plain" });
    const result = await uploadAvatar(fakeFile);
    assert.equal(result.error, "invalid_file");
    assert.equal(result.avatarUrl, null);
  });

  test("falls back to local data URL storage when Supabase is offline", async () => {
    const fakeFile = new File(["fake png data"], "avatar.png", { type: "image/png" });
    const result = await uploadAvatar(fakeFile);

    assert.equal(result.error, null);
    assert.ok(result.avatarUrl);
    assert.ok(result.avatarUrl?.startsWith("data:image/png;base64,"));

    // Reloading avatar retrieves stored local avatar
    const reloaded = await loadAvatar();
    assert.equal(reloaded.avatarUrl, result.avatarUrl);
    assert.equal(reloaded.error, null);
  });
});
