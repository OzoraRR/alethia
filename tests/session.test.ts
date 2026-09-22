import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getOrCreateAnonymousSession,
  getSessionId,
  clearAnonymousSession,
  type SessionData,
} from "../lib/session/session";
import { safeGetItem, STORAGE_KEYS } from "../lib/storage/safe-storage";

describe("Anonymous Session Layer", () => {
  beforeEach(() => {
    clearAnonymousSession();
  });

  test("automatically creates anonymous session without manual login", async () => {
    const session = await getOrCreateAnonymousSession();

    assert.ok(session.sessionId);
    assert.equal(typeof session.sessionId, "string");
    assert.equal(session.isAnonymous, true);
    assert.ok(session.createdAt);

    // Verify persisted in safe storage
    const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null);
    assert.ok(stored);
    assert.equal(stored?.sessionId, session.sessionId);
  });

  test("deduplicates concurrent session creation calls (singleton promise)", async () => {
    const [s1, s2, s3] = await Promise.all([
      getOrCreateAnonymousSession(),
      getOrCreateAnonymousSession(),
      getOrCreateAnonymousSession(),
    ]);

    assert.equal(s1.sessionId, s2.sessionId);
    assert.equal(s2.sessionId, s3.sessionId);
  });

  test("getSessionId returns synchronous identifier and maintains consistency", async () => {
    const session = await getOrCreateAnonymousSession();
    const synchronousId = getSessionId();

    assert.equal(synchronousId, session.sessionId);
  });

  test("clears session cleanly and allows fresh initialization", async () => {
    const firstSession = await getOrCreateAnonymousSession();
    assert.ok(firstSession.sessionId);

    clearAnonymousSession();
    const stored = safeGetItem(STORAGE_KEYS.SESSION, null);
    assert.equal(stored, null);

    const secondSession = await getOrCreateAnonymousSession();
    assert.ok(secondSession.sessionId);
    assert.notEqual(firstSession.sessionId, secondSession.sessionId);
  });
});
