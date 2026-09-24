import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadCourierChallenge,
  saveCourierChallenge,
  clearCourierChallenge,
  loadSocialChallenge,
  saveSocialChallenge,
  clearSocialChallenge,
  loadActiveFlow,
  saveActiveFlow,
  clearActiveFlow,
  type StoredCourierChallenge,
  type StoredSocialChallenge,
} from "../features/simulation/challenge-persistence";
import { safeSetItem, STORAGE_KEYS } from "../lib/storage/safe-storage";

describe("Challenge State Persistence Layer", () => {
  beforeEach(() => {
    clearCourierChallenge();
    clearSocialChallenge();
    clearActiveFlow();
  });

  test("persists and restores courier challenge state across navigation", () => {
    const challengeState: StoredCourierChallenge = {
      sessionId: "session_123",
      stage: "inspect",
      inspectedSignals: ["sender", "link"],
      retryInspectedSignals: [],
      verificationOpen: false,
      verificationChecked: true,
      decision: null,
      retryDecision: null,
      attemptId: "attempt_456",
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
    };

    saveCourierChallenge(challengeState);

    const loaded = loadCourierChallenge("session_123");
    assert.ok(loaded);
    assert.equal(loaded?.stage, "inspect");
    assert.deepEqual(loaded?.inspectedSignals, ["sender", "link"]);
    assert.equal(loaded?.verificationChecked, true);
    assert.equal(loaded?.attemptId, "attempt_456");

    // Check active flow was saved
    const flow = loadActiveFlow();
    assert.equal(flow?.activeModule, "courier-sms");
    assert.equal(flow?.stage, "inspect");
  });

  test("isolates challenge state per session ID", () => {
    const challengeState: StoredCourierChallenge = {
      sessionId: "session_A",
      stage: "verify",
      inspectedSignals: ["sender"],
      retryInspectedSignals: [],
      verificationOpen: true,
      verificationChecked: false,
      decision: null,
      retryDecision: null,
      attemptId: null,
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
    };

    saveCourierChallenge(challengeState);

    // Matching session returns data
    assert.ok(loadCourierChallenge("session_A"));
    // Mismatched session returns null
    assert.equal(loadCourierChallenge("session_B"), null);
  });

  test("persists and restores social engineering challenge state across refresh", () => {
    const socialState: StoredSocialChallenge = {
      sessionId: "session_abc",
      stage: "pressure",
      primarySignals: ["seller", "payment"],
      retrySignals: [],
      decision: null,
      retryDecision: null,
      attemptId: "att_789",
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
    };

    saveSocialChallenge(socialState);

    const loaded = loadSocialChallenge("session_abc");
    assert.ok(loaded);
    assert.equal(loaded?.stage, "pressure");
    assert.deepEqual(loaded?.primarySignals, ["seller", "payment"]);

    const flow = loadActiveFlow();
    assert.equal(flow?.activeModule, "social-engineering");
    assert.equal(flow?.stage, "pressure");
  });

  test("clears challenge state upon completion or intentional reset", () => {
    saveActiveFlow("courier-sms", "briefing");
    assert.equal(loadActiveFlow()?.activeModule, "courier-sms");

    saveCourierChallenge({
      sessionId: "session_123",
      stage: "decide",
      inspectedSignals: ["sender"],
      retryInspectedSignals: [],
      verificationOpen: false,
      verificationChecked: true,
      decision: "verify_official_channel",
      retryDecision: null,
      attemptId: null,
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
    });

    assert.ok(loadCourierChallenge());

    clearCourierChallenge();
    assert.equal(loadCourierChallenge(), null);
    assert.equal(loadActiveFlow(), null);
  });

  test("handles corrupted storage data without crashing", () => {
    safeSetItem(STORAGE_KEYS.CHALLENGE_COURIER, {
      sessionId: "session_123",
      stage: "INVALID_STAGE_NOT_IN_ENUM",
    });

    const result = loadCourierChallenge();
    assert.equal(result, null);
  });
});
