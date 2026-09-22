"use client";

import { useEffect, useState } from "react";
import type { Decision } from "../simulation/types";
import { safeGetItem, safeSetItem, STORAGE_KEYS } from "../../lib/storage/safe-storage";
import {
  loadRemoteProgress,
  persistProgressSnapshot,
  type RemoteProgress,
} from "./supabase-persistence";

export const moduleIds = ["courier-sms", "social-engineering"] as const;
export type ModuleId = (typeof moduleIds)[number];
export const masteryStates = ["not_started", "familiar", "skilled", "needs_practice"] as const;
export type MasteryState = (typeof masteryStates)[number];
export type RetryResult = "safe" | "unsafe" | null;

export type PracticeProgress = {
  courierSmsCompleted: boolean;
  socialEngineeringCompleted: boolean;
  modulesCompleted: number;
  mastery: MasteryState;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining: number;
  lastQualifyingDate: string | null;
  lastRetryResult: RetryResult;
  habits: { inspect: boolean; verify: boolean; report: boolean };
  badges: string[];
};

type CompletionHabits = Partial<PracticeProgress["habits"]>;

export const defaultProgress: PracticeProgress = {
  courierSmsCompleted: false,
  socialEngineeringCompleted: false,
  modulesCompleted: 0,
  mastery: "not_started",
  currentStreak: 0,
  longestStreak: 0,
  freezesRemaining: 1,
  lastQualifyingDate: null,
  lastRetryResult: null,
  habits: { inspect: false, verify: false, report: false },
  badges: [],
};

export function loadProgress(): PracticeProgress {
  return safeGetItem(STORAGE_KEYS.PROGRESS, defaultProgress, (val): val is PracticeProgress => {
    return isRecord(val);
  });
}

export function saveProgress(progress: PracticeProgress): void {
  safeSetItem(STORAGE_KEYS.PROGRESS, progress);
}

export function recordCourierSmsCompletion({
  retryDecision,
  completedAt = localDateKey(),
}: {
  retryDecision: Decision;
  completedAt?: string;
  attemptId?: string | null;
}): PracticeProgress {
  return recordModuleCompletion({
    moduleId: "courier-sms",
    outcome: retryDecision === "open_link" ? "unsafe" : "safe",
    completedAt,
    habits: {
      inspect: true,
      verify: true,
      report: retryDecision === "report_delete",
    },
  });
}

export function recordModuleCompletion({
  moduleId,
  outcome,
  completedAt = localDateKey(),
  habits = {},
}: {
  moduleId: ModuleId;
  outcome: Exclude<RetryResult, null>;
  completedAt?: string;
  habits?: CompletionHabits;
}): PracticeProgress {
  const currentProgress = loadProgress();
  const isFirstModuleCompletion = !isModuleComplete(currentProgress, moduleId);
  const nextStreak = calculateNextStreak(currentProgress, completedAt);
  const courierSmsCompleted =
    moduleId === "courier-sms" ? true : currentProgress.courierSmsCompleted;
  const socialEngineeringCompleted =
    moduleId === "social-engineering" ? true : currentProgress.socialEngineeringCompleted;

  const nextProgress: PracticeProgress = {
    ...currentProgress,
    courierSmsCompleted,
    socialEngineeringCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted),
    mastery: isFirstModuleCompletion
      ? "familiar"
      : outcome === "unsafe"
        ? "needs_practice"
        : "skilled",
    currentStreak: nextStreak.currentStreak,
    longestStreak: nextStreak.longestStreak,
    freezesRemaining: nextStreak.freezesRemaining,
    lastQualifyingDate: completedAt,
    lastRetryResult: outcome,
    habits: {
      inspect: currentProgress.habits.inspect || habits.inspect === true,
      verify: currentProgress.habits.verify || habits.verify === true,
      report: currentProgress.habits.report || habits.report === true,
    },
    badges: currentProgress.badges.includes("first_practice")
      ? currentProgress.badges
      : [...currentProgress.badges, "first_practice"],
  };

  saveProgress(nextProgress);
  return nextProgress;
}

export function useLocalProgress(): PracticeProgress {
  const [progress, setProgress] = useState<PracticeProgress>(defaultProgress);

  useEffect(() => {
    let cancelled = false;
    const localProgress = loadProgress();
    setProgress(localProgress);

    void loadRemoteProgress()
      .then((remoteProgress) => {
        if (cancelled) return;
        if (!remoteProgress) {
          synchronizeLocalCompletions(localProgress);
          return;
        }
        const mergedProgress = mergeProgress(localProgress, remoteProgress);
        saveProgress(mergedProgress);
        setProgress(mergedProgress);
        synchronizeLocalCompletions(localProgress, mergedProgress);
      })
      .catch(() => undefined);

    // Cross-tab synchronization
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.PROGRESS) {
        if (event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue) as unknown;
            setProgress(normalizeProgress(parsed));
          } catch {
            // Ignored
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, []);

  return progress;
}

export function resetProgress(): void {
  saveProgress(defaultProgress);
}

function synchronizeLocalCompletions(localProgress: PracticeProgress, snapshot = localProgress) {
  moduleIds
    .filter((moduleId) => isModuleComplete(localProgress, moduleId))
    .forEach((moduleId) => {
      void persistProgressSnapshot({ progress: snapshot, moduleId }).catch(() => undefined);
    });
}

export function mergeProgress(
  localProgress: PracticeProgress,
  remoteProgress: RemoteProgress,
): PracticeProgress {
  const courierSmsCompleted =
    localProgress.courierSmsCompleted || remoteProgress.courierSmsCompleted;
  const socialEngineeringCompleted =
    localProgress.socialEngineeringCompleted || remoteProgress.socialEngineeringCompleted;
  const localHasCompletion = hasCompletion(localProgress);

  return {
    ...localProgress,
    courierSmsCompleted,
    socialEngineeringCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted),
    mastery:
      localHasCompletion && localProgress.mastery !== "not_started"
        ? localProgress.mastery
        : remoteProgress.mastery,
    currentStreak: localProgress.lastQualifyingDate
      ? localProgress.currentStreak
      : remoteProgress.currentStreak,
    longestStreak: Math.max(localProgress.longestStreak, remoteProgress.longestStreak),
    freezesRemaining: localProgress.lastQualifyingDate
      ? localProgress.freezesRemaining
      : remoteProgress.freezesRemaining,
    lastQualifyingDate: localProgress.lastQualifyingDate ?? remoteProgress.lastQualifyingDate,
    lastRetryResult: localProgress.lastRetryResult ?? remoteProgress.lastRetryResult,
    habits: {
      inspect: localProgress.habits.inspect || remoteProgress.habits.inspect,
      verify: localProgress.habits.verify || remoteProgress.habits.verify,
      report: localProgress.habits.report || remoteProgress.habits.report,
    },
    badges: [...new Set([...localProgress.badges, ...remoteProgress.badges])],
  };
}

function isModuleComplete(progress: PracticeProgress, moduleId: ModuleId) {
  return moduleId === "courier-sms"
    ? progress.courierSmsCompleted
    : progress.socialEngineeringCompleted;
}

function hasCompletion(progress: PracticeProgress) {
  return progress.courierSmsCompleted || progress.socialEngineeringCompleted;
}

export function calculateNextStreak(progress: PracticeProgress, completedAt: string) {
  if (!progress.lastQualifyingDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(progress.longestStreak, 1),
      freezesRemaining: progress.freezesRemaining,
    };
  }
  const daysSinceLastCompletion = daysBetween(progress.lastQualifyingDate, completedAt);
  if (daysSinceLastCompletion === 0) return progress;
  if (daysSinceLastCompletion === 1) {
    const currentStreak = progress.currentStreak + 1;
    return {
      currentStreak,
      longestStreak: Math.max(progress.longestStreak, currentStreak),
      freezesRemaining: progress.freezesRemaining,
    };
  }
  if (daysSinceLastCompletion === 2 && progress.freezesRemaining > 0) {
    const currentStreak = progress.currentStreak + 1;
    return {
      currentStreak,
      longestStreak: Math.max(progress.longestStreak, currentStreak),
      freezesRemaining: progress.freezesRemaining - 1,
    };
  }
  return {
    currentStreak: 1,
    longestStreak: Math.max(progress.longestStreak, 1),
    freezesRemaining: progress.freezesRemaining,
  };
}

export function normalizeProgress(value: unknown): PracticeProgress {
  if (!isRecord(value)) return defaultProgress;
  const courierSmsCompleted = value.courierSmsCompleted === true;
  const socialEngineeringCompleted = value.socialEngineeringCompleted === true;
  const habits = isRecord(value.habits) ? value.habits : {};

  return {
    courierSmsCompleted,
    socialEngineeringCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted),
    mastery: isMasteryState(value.mastery) ? value.mastery : defaultProgress.mastery,
    currentStreak: nonNegativeInteger(value.currentStreak),
    longestStreak: nonNegativeInteger(value.longestStreak),
    freezesRemaining: Math.min(nonNegativeInteger(value.freezesRemaining), 1),
    lastQualifyingDate:
      typeof value.lastQualifyingDate === "string" ? value.lastQualifyingDate : null,
    lastRetryResult:
      value.lastRetryResult === "safe" || value.lastRetryResult === "unsafe"
        ? value.lastRetryResult
        : null,
    habits: {
      inspect: habits.inspect === true,
      verify: habits.verify === true,
      report: habits.report === true,
    },
    badges: Array.isArray(value.badges)
      ? value.badges.filter((badge): badge is string => typeof badge === "string")
      : [],
  };
}

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function daysBetween(previousDate: string, currentDate: string): number {
  const previous = Date.parse(`${previousDate}T00:00:00`);
  const current = Date.parse(`${currentDate}T00:00:00`);
  return Number.isNaN(previous) || Number.isNaN(current)
    ? Number.NaN
    : Math.round((current - previous) / 86_400_000);
}

function isMasteryState(value: unknown): value is MasteryState {
  return typeof value === "string" && masteryStates.includes(value as MasteryState);
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
