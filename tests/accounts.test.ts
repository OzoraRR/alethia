import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { login, register } from "../lib/auth/accounts";
import { safeRemoveItem, STORAGE_KEYS } from "../lib/storage/safe-storage";

describe("Local operator accounts", () => {
  beforeEach(() => {
    safeRemoveItem(STORAGE_KEYS.ACCOUNTS);
  });

  test("registers with username, email, password and confirm", async () => {
    const result = await register({
      username: "sinyal_ops",
      email: "ops@example.id",
      password: "rahasia123",
      confirm: "rahasia123",
    });
    assert.ok("account" in result);
    assert.equal(result.account.username, "sinyal_ops");
  });

  test("rejects mismatched confirmation and short passwords", async () => {
    const mismatch = await register({
      username: "a_b", email: "a@b.id", password: "rahasia123", confirm: "beda1234",
    });
    assert.deepEqual(mismatch, { error: "password_mismatch" });

    const short = await register({
      username: "a_b", email: "a@b.id", password: "pendek", confirm: "pendek",
    });
    assert.deepEqual(short, { error: "password_short" });
  });

  test("rejects duplicate username and email", async () => {
    await register({ username: "ops", email: "ops@x.id", password: "rahasia123", confirm: "rahasia123" });
    const dupUser = await register({ username: "ops", email: "lain@x.id", password: "rahasia123", confirm: "rahasia123" });
    assert.deepEqual(dupUser, { error: "username_taken" });
    const dupEmail = await register({ username: "lain", email: "ops@x.id", password: "rahasia123", confirm: "rahasia123" });
    assert.deepEqual(dupEmail, { error: "email_taken" });
  });

  test("logs in with username or email, rejects wrong password", async () => {
    await register({ username: "ops", email: "ops@x.id", password: "rahasia123", confirm: "rahasia123" });
    const byUser = await login({ identifier: "ops", password: "rahasia123" });
    assert.ok("account" in byUser);
    const byEmail = await login({ identifier: "OPS@x.id", password: "rahasia123" });
    assert.ok("account" in byEmail);
    const wrong = await login({ identifier: "ops", password: "salah123" });
    assert.deepEqual(wrong, { error: "invalid_credentials" });
  });
});
