"use client";

import { useEffect, useState } from "react";
import type { Decision } from "../simulation/types";
import { safeGetItem, safeSetItem, STORAGE_KEYS } from "../../lib/storage/safe-storage";
import {
  loadRemoteProgress,
  persistProgressSnapshot,
  type RemoteProgress,
} from "./supabase-persistence";

export const moduleIds = ["courier-sms", "social-engineering", "executable-file"] as const;
export type ModuleId = (typeof moduleIds)[number];
export const moduleProgressStatuses = ["not_started", "in_progress", "completed"] as const;
export type ModuleProgressStatus = (typeof moduleProgressStatuses)[number];
export type ModuleProgressSnapshot = {
  status: ModuleProgressStatus;
  score: number | null;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};
export type ModuleProgressMap = Record<ModuleId, ModuleProgressSnapshot>;
export const masteryStates = ["not_started", "familiar", "skilled", "needs_practice"] as const;
export type MasteryState = (typeof masteryStates)[number];
export type RetryResult = "safe" | "unsafe" | null;

export type PracticeProgress = {
  courierSmsCompleted: boolean;
  socialEngineeringCompleted: boolean;
  executableFileCompleted: boolean;
  modulesCompleted: number;
  mastery: MasteryState;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining: number;
  lastQualifyingDate: string | null;
  lastRetryResult: RetryResult;
  habits: { inspect: boolean; verify: boolean; report: boolean };
  moduleProgress: ModuleProgressMap;
  badges: string[];
};

type CompletionHabits = Partial<PracticeProgress["habits"]>;

export const defaultProgress: PracticeProgress = {
  courierSmsCompleted: false,
  socialEngineeringCompleted: false,
  executableFileCompleted: false,
  modulesCompleted: 0,
  mastery: "not_started",
  currentStreak: 0,
  longestStreak: 0,
  freezesRemaining: 1,
  lastQualifyingDate: null,
  lastRetryResult: null,
  habits: { inspect: false, verify: false, report: false },
  moduleProgress: emptyModuleProgress(),
  badges: [],
};

export function emptyModuleProgress(): ModuleProgressMap {
  return {
    "courier-sms": emptyModuleProgressSnapshot(),
    "social-engineering": emptyModuleProgressSnapshot(),
    "executable-file": emptyModuleProgressSnapshot(),
  };
}

export function loadProgress(): PracticeProgress {
  const stored = safeGetItem(STORAGE_KEYS.PROGRESS, defaultProgress, isRecord);
  return normalizeProgress(stored);
}

export function saveProgress(progress: PracticeProgress): void {
  safeSetItem(STORAGE_KEYS.PROGRESS, progress);
}

/**
 * Pushes local anonymous progress to the newly authenticated account and then
 * reconciles it with any remote rows that already exist. The local snapshot is
 * retained when Supabase is offline, so registration never discards practice.
 */
export async function mergeLocalProgressIntoAccount(): Promise<PracticeProgress> {
  const localProgress = loadProgress();

  await Promise.all(
    moduleIds
      .filter((moduleId) => isModuleComplete(localProgress, moduleId))
      .map((moduleId) =>
        persistProgressSnapshot({ progress: localProgress, moduleId }),
      ),
  );

  const remoteProgress = await loadRemoteProgress();
  const mergedProgress = remoteProgress
    ? mergeProgress(localProgress, remoteProgress)
    : localProgress;
  saveProgress(mergedProgress);
  return mergedProgress;
}

export function recordModuleStart(
  moduleId: ModuleId,
  startedAt = new Date().toISOString(),
): PracticeProgress {
  const currentProgress = loadProgress();
  const currentModule = currentProgress.moduleProgress[moduleId];
  if (currentModule.status === "completed") return currentProgress;

  const nextProgress: PracticeProgress = {
    ...currentProgress,
    moduleProgress: {
      ...currentProgress.moduleProgress,
      [moduleId]: {
        ...currentModule,
        status: "in_progress",
        progressPercentage: Math.max(currentModule.progressPercentage, 1),
        startedAt: currentModule.startedAt ?? startedAt,
        completedAt: null,
        updatedAt: startedAt,
      },
    },
  };

  saveProgress(nextProgress);
  return nextProgress;
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
    outcome: retryDecision === "open_link" || retryDecision === "reply_sender" ? "unsafe" : "safe",
    completedAt,
    habits: {
      inspect: true,
      verify: true,
      report: retryDecision === "report_delete" || retryDecision === "report_message",
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
  const updatedAt = new Date().toISOString();
  const currentModuleProgress = currentProgress.moduleProgress[moduleId];
  const courierSmsCompleted =
    moduleId === "courier-sms" ? true : currentProgress.courierSmsCompleted;
  const socialEngineeringCompleted =
    moduleId === "social-engineering" ? true : currentProgress.socialEngineeringCompleted;
  const executableFileCompleted =
    moduleId === "executable-file" ? true : currentProgress.executableFileCompleted;
  const nextProgress: PracticeProgress = {
    ...currentProgress,
    courierSmsCompleted,
    socialEngineeringCompleted,
    executableFileCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted),
    mastery: moduleId === "courier-sms" ? (isFirstModuleCompletion ? "familiar" : outcome === "unsafe" ? "needs_practice" : "skilled") : currentProgress.mastery,
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
    moduleProgress: {
      ...currentProgress.moduleProgress,
      [moduleId]: {
        ...currentModuleProgress,
        status: "completed",
        progressPercentage: 100,
        startedAt: currentModuleProgress.startedAt ?? updatedAt,
        completedAt: updatedAt,
        updatedAt,
      },
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
  const executableFileCompleted =
    localProgress.executableFileCompleted || Boolean(remoteProgress.executableFileCompleted);
  const localHasCourierCompletion = localProgress.courierSmsCompleted;
  const moduleProgress = mergeModuleProgress(localProgress, remoteProgress);
  return {
    ...localProgress,
    courierSmsCompleted,
    socialEngineeringCompleted,
    executableFileCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted),
    mastery:
      localHasCourierCompletion && localProgress.mastery !== "not_started"
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
    moduleProgress,
    badges: [...new Set([...localProgress.badges, ...remoteProgress.badges])],
  };
}
type ModuleCompletionFlags = {
  courierSmsCompleted?: boolean;
  socialEngineeringCompleted?: boolean;
  executableFileCompleted?: boolean;
};

function isModuleComplete(progress: ModuleCompletionFlags, moduleId: ModuleId) {
  if (moduleId === "courier-sms") return progress.courierSmsCompleted === true;
  if (moduleId === "social-engineering") return progress.socialEngineeringCompleted === true;
  return progress.executableFileCompleted === true;
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
  const executableFileCompleted = value.executableFileCompleted === true;
  const habits = isRecord(value.habits) ? value.habits : {};
  const moduleProgress = normalizeModuleProgress(value.moduleProgress);
  if (courierSmsCompleted) markModuleCompleted(moduleProgress, "courier-sms");
  if (socialEngineeringCompleted) markModuleCompleted(moduleProgress, "social-engineering");
  if (executableFileCompleted) markModuleCompleted(moduleProgress, "executable-file");

  return {
    courierSmsCompleted,
    socialEngineeringCompleted,
    executableFileCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted),
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
    moduleProgress,
    badges: Array.isArray(value.badges)
      ? value.badges.filter((badge): badge is string => typeof badge === "string")
      : [],
  };
}

function emptyModuleProgressSnapshot(): ModuleProgressSnapshot {
  return {
    status: "not_started",
    score: null,
    progressPercentage: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
  };
}

function normalizeModuleProgress(value: unknown): ModuleProgressMap {
  const candidate = isRecord(value) ? value : {};
  return Object.fromEntries(
    moduleIds.map((moduleId) => {
      const row = isRecord(candidate[moduleId]) ? candidate[moduleId] : {};
      const rawStatus = row.status;
      const status = moduleProgressStatuses.includes(rawStatus as ModuleProgressStatus)
        ? (rawStatus as ModuleProgressStatus)
        : "not_started";
      const progressPercentage =
        status === "completed"
          ? 100
          : status === "in_progress"
            ? Math.min(Math.max(nonNegativeInteger(row.progressPercentage), 1), 99)
            : 0;
      const rawScore = row.score;
      const score =
        typeof rawScore === "number" && Number.isInteger(rawScore) && rawScore >= 0 && rawScore <= 100
          ? rawScore
          : null;

      return [
        moduleId,
        {
          status,
          score,
          progressPercentage,
          startedAt: nullableTimestamp(row.startedAt),
          completedAt: nullableTimestamp(row.completedAt),
          updatedAt: nullableTimestamp(row.updatedAt),
        } satisfies ModuleProgressSnapshot,
      ];
    }),
  ) as ModuleProgressMap;
}

function mergeModuleProgress(
  localProgress: PracticeProgress,
  remoteProgress: RemoteProgress,
): ModuleProgressMap {
  const local = normalizeModuleProgress(localProgress.moduleProgress);
  const remote = normalizeModuleProgress(remoteProgress.moduleProgress);

  return Object.fromEntries(
    moduleIds.map((moduleId) => {
      const localRow = local[moduleId];
      const remoteRow = remote[moduleId];
      const localComplete = isModuleComplete(localProgress, moduleId);
      const remoteComplete = isModuleComplete(remoteProgress, moduleId);
      const isComplete = localComplete || remoteComplete || localRow.status === "completed" || remoteRow.status === "completed";
      const status: ModuleProgressStatus = isComplete
        ? "completed"
        : localRow.status === "in_progress" || remoteRow.status === "in_progress"
          ? "in_progress"
          : "not_started";
      const startedAt = localRow.startedAt ?? remoteRow.startedAt;
      const completedAt = isComplete
        ? latestTimestamp(localRow.completedAt, remoteRow.completedAt, localRow.updatedAt, remoteRow.updatedAt)
        : null;

      return [
        moduleId,
        {
          status,
          score: remoteRow.score ?? localRow.score,
          progressPercentage: isComplete
            ? 100
            : status === "in_progress"
              ? Math.max(localRow.progressPercentage, remoteRow.progressPercentage, 1)
              : 0,
          startedAt: isComplete ? startedAt ?? completedAt : startedAt,
          completedAt,
          updatedAt: latestTimestamp(localRow.updatedAt, remoteRow.updatedAt),
        } satisfies ModuleProgressSnapshot,
      ];
    }),
  ) as ModuleProgressMap;
}

function markModuleCompleted(progress: ModuleProgressMap, moduleId: ModuleId): void {
  const current = progress[moduleId];
  const updatedAt = current.updatedAt ?? new Date().toISOString();
  progress[moduleId] = {
    ...current,
    status: "completed",
    progressPercentage: 100,
    startedAt: current.startedAt ?? updatedAt,
    completedAt: current.completedAt ?? updatedAt,
    updatedAt,
  };
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function latestTimestamp(...values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
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
