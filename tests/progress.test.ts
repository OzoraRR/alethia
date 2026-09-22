import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadProgress,
  saveProgress,
  recordCourierSmsCompletion,
  recordModuleCompletion,
  calculateNextStreak,
  normalizeProgress,
  mergeProgress,
  defaultProgress,
  type PracticeProgress,
} from "../features/progress/progress";
import { safeRemoveItem, STORAGE_KEYS } from "../lib/storage/safe-storage";

describe("Progress Persistence and Streak Layer", () => {
  beforeEach(() => {
    safeRemoveItem(STORAGE_KEYS.PROGRESS);
  });

  test("loads default progress when storage is empty", () => {
    const progress = loadProgress();
    assert.deepEqual(progress, defaultProgress);
  });

  test("saves and loads practice progress correctly", () => {
    const updated: PracticeProgress = {
      ...defaultProgress,
      courierSmsCompleted: true,
      modulesCompleted: 1,
      mastery: "familiar",
      currentStreak: 2,
      longestStreak: 2,
    };
    saveProgress(updated);

    const loaded = loadProgress();
    assert.deepEqual(loaded, updated);
  });

  test("calculates streaks accurately across consecutive days and freezes", () => {
    const base: PracticeProgress = {
      ...defaultProgress,
      currentStreak: 1,
      longestStreak: 1,
      freezesRemaining: 1,
      lastQualifyingDate: "2026-09-20",
    };

    // Same day completion -> streak unchanged
    const sameDay = calculateNextStreak(base, "2026-09-20");
    assert.equal(sameDay.currentStreak, 1);

    // Consecutive day -> streak + 1
    const nextDay = calculateNextStreak(base, "2026-09-21");
    assert.equal(nextDay.currentStreak, 2);
    assert.equal(nextDay.longestStreak, 2);

    // Skipped 1 day with freeze remaining -> streak preserved + 1, freeze consumed
    const streakWithFreeze = calculateNextStreak(base, "2026-09-22");
    assert.equal(streakWithFreeze.currentStreak, 2);
    assert.equal(streakWithFreeze.freezesRemaining, 0);

    // Skipped multiple days without freeze -> resets to 1
    const noFreezeBase: PracticeProgress = {
      ...base,
      freezesRemaining: 0,
    };
    const brokenStreak = calculateNextStreak(noFreezeBase, "2026-09-25");
    assert.equal(brokenStreak.currentStreak, 1);
  });

  test("records courier-sms completion and updates progress", () => {
    const progress = recordCourierSmsCompletion({
      retryDecision: "verify_official_channel",
      completedAt: "2026-09-22",
    });

    assert.equal(progress.courierSmsCompleted, true);
    assert.equal(progress.modulesCompleted, 1);
    assert.equal(progress.lastRetryResult, "safe");
    assert.equal(progress.habits.inspect, true);
    assert.equal(progress.habits.verify, true);
    assert.ok(progress.badges.includes("first_practice"));
  });

  test("records social-engineering completion and updates progress", () => {
    const progress = recordModuleCompletion({
      moduleId: "social-engineering",
      outcome: "safe",
      completedAt: "2026-09-22",
      habits: { inspect: true, verify: true, report: true },
    });

    assert.equal(progress.socialEngineeringCompleted, true);
    assert.equal(progress.lastRetryResult, "safe");
    assert.equal(progress.habits.report, true);
  });

  test("merges local and remote progress without losing local completions", () => {
    const local: PracticeProgress = {
      ...defaultProgress,
      courierSmsCompleted: true,
      modulesCompleted: 1,
      currentStreak: 3,
      longestStreak: 3,
      habits: { inspect: true, verify: true, report: false },
      badges: ["first_practice"],
      lastQualifyingDate: "2026-09-22",
    };

    const remote = {
      courierSmsCompleted: false,
      socialEngineeringCompleted: true,
      modulesCompleted: 1,
      mastery: "skilled" as const,
      currentStreak: 5,
      longestStreak: 5,
      freezesRemaining: 1,
      lastQualifyingDate: "2026-09-21",
      lastRetryResult: "safe" as const,
      habits: { inspect: true, verify: false, report: true },
      badges: ["first_practice", "social_master"],
    };

    const merged = mergeProgress(local, remote);

    // Both modules should now be completed
    assert.equal(merged.courierSmsCompleted, true);
    assert.equal(merged.socialEngineeringCompleted, true);
    assert.equal(merged.modulesCompleted, 2);
    // Habits combined
    assert.equal(merged.habits.inspect, true);
    assert.equal(merged.habits.verify, true);
    assert.equal(merged.habits.report, true);
    // Badges combined
    assert.ok(merged.badges.includes("first_practice"));
    assert.ok(merged.badges.includes("social_master"));
  });

  test("safely normalizes corrupted progress objects", () => {
    const corrupted = {
      courierSmsCompleted: "INVALID_BOOLEAN",
      currentStreak: -99,
      mastery: "NOT_AN_ENUM",
      badges: null,
    };

    const normalized = normalizeProgress(corrupted);
    assert.equal(normalized.courierSmsCompleted, false);
    assert.equal(normalized.currentStreak, 0);
    assert.equal(normalized.mastery, "not_started");
    assert.deepEqual(normalized.badges, []);
  });
});
