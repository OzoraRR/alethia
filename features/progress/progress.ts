"use client";

import { useEffect, useState } from "react";
import type { Decision } from "@/features/simulation/types";
import { loadRemoteProgress, persistProgressSnapshot, type RemoteProgress } from "./supabase-persistence";

export const moduleIds = ["courier-sms", "social-engineering", "executable-file"] as const;
export type ModuleId = (typeof moduleIds)[number];
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
  badges: string[];
};
type CompletionHabits = Partial<PracticeProgress["habits"]>;
const progressStorageKey = "alethia:practice-progress:v1";

export const defaultProgress: PracticeProgress = {
  courierSmsCompleted: false, socialEngineeringCompleted: false, executableFileCompleted: false, modulesCompleted: 0, mastery: "not_started", currentStreak: 0, longestStreak: 0, freezesRemaining: 1, lastQualifyingDate: null, lastRetryResult: null,
  habits: { inspect: false, verify: false, report: false }, badges: [],
};

export function loadProgress(): PracticeProgress {
  if (typeof window === "undefined") return defaultProgress;
  try { const storedProgress = window.localStorage.getItem(progressStorageKey); return storedProgress ? normalizeProgress(JSON.parse(storedProgress) as unknown) : defaultProgress; } catch { return defaultProgress; }
}
export function saveProgress(progress: PracticeProgress): void { if (typeof window === "undefined") return; try { window.localStorage.setItem(progressStorageKey, JSON.stringify(progress)); } catch { /* Local progress never blocks a simulation. */ } }

export function recordCourierSmsCompletion({ retryDecision, completedAt = localDateKey() }: { retryDecision: Decision; completedAt?: string; attemptId?: string | null }): PracticeProgress {
  return recordModuleCompletion({ moduleId: "courier-sms", outcome: retryDecision === "open_link" || retryDecision === "reply_sender" ? "unsafe" : "safe", completedAt, habits: { inspect: true, verify: true, report: retryDecision === "report_message" } });
}

export function recordModuleCompletion({ moduleId, outcome, completedAt = localDateKey(), habits = {} }: { moduleId: ModuleId; outcome: Exclude<RetryResult, null>; completedAt?: string; habits?: CompletionHabits }): PracticeProgress {
  const currentProgress = loadProgress();
  const isFirstModuleCompletion = !isModuleComplete(currentProgress, moduleId);
  const nextStreak = calculateNextStreak(currentProgress, completedAt);
  const courierSmsCompleted = moduleId === "courier-sms" ? true : currentProgress.courierSmsCompleted;
  const socialEngineeringCompleted = moduleId === "social-engineering" ? true : currentProgress.socialEngineeringCompleted;
  const executableFileCompleted = moduleId === "executable-file" ? true : currentProgress.executableFileCompleted;
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
    badges: currentProgress.badges.includes("first_practice") ? currentProgress.badges : [...currentProgress.badges, "first_practice"],
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
    void loadRemoteProgress().then((remoteProgress) => {
      if (cancelled) return;
      if (!remoteProgress) { synchronizeLocalCompletions(localProgress); return; }
      const mergedProgress = mergeProgress(localProgress, remoteProgress);
      saveProgress(mergedProgress);
      setProgress(mergedProgress);
      synchronizeLocalCompletions(localProgress, mergedProgress);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return progress;
}

function synchronizeLocalCompletions(localProgress: PracticeProgress, snapshot = localProgress) {
  moduleIds.filter((moduleId) => isModuleComplete(localProgress, moduleId)).forEach((moduleId) => {
    void persistProgressSnapshot({ progress: snapshot, moduleId }).catch(() => undefined);
  });
}
function mergeProgress(localProgress: PracticeProgress, remoteProgress: RemoteProgress): PracticeProgress {
  const courierSmsCompleted = localProgress.courierSmsCompleted || remoteProgress.courierSmsCompleted;
  const socialEngineeringCompleted = localProgress.socialEngineeringCompleted || remoteProgress.socialEngineeringCompleted;
  const executableFileCompleted = localProgress.executableFileCompleted || remoteProgress.executableFileCompleted;
  const localHasCourierCompletion = localProgress.courierSmsCompleted;
  return {
    ...localProgress,
    courierSmsCompleted,
    socialEngineeringCompleted,
    executableFileCompleted,
    modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted),
    mastery: localHasCourierCompletion && localProgress.mastery !== "not_started" ? localProgress.mastery : remoteProgress.mastery,
    currentStreak: localProgress.lastQualifyingDate ? localProgress.currentStreak : remoteProgress.currentStreak,
    longestStreak: Math.max(localProgress.longestStreak, remoteProgress.longestStreak),
    freezesRemaining: localProgress.lastQualifyingDate ? localProgress.freezesRemaining : remoteProgress.freezesRemaining,
    lastQualifyingDate: localProgress.lastQualifyingDate ?? remoteProgress.lastQualifyingDate,
    lastRetryResult: localProgress.lastRetryResult ?? remoteProgress.lastRetryResult,
    habits: { inspect: localProgress.habits.inspect || remoteProgress.habits.inspect, verify: localProgress.habits.verify || remoteProgress.habits.verify, report: localProgress.habits.report || remoteProgress.habits.report },
    badges: [...new Set([...localProgress.badges, ...remoteProgress.badges])],
  };
}
function isModuleComplete(progress: PracticeProgress, moduleId: ModuleId) {
  if (moduleId === "courier-sms") return progress.courierSmsCompleted;
  if (moduleId === "social-engineering") return progress.socialEngineeringCompleted;
  return progress.executableFileCompleted;
}
function calculateNextStreak(progress: PracticeProgress, completedAt: string) {
  if (!progress.lastQualifyingDate) return { currentStreak: 1, longestStreak: Math.max(progress.longestStreak, 1), freezesRemaining: progress.freezesRemaining };
  const daysSinceLastCompletion = daysBetween(progress.lastQualifyingDate, completedAt);
  if (daysSinceLastCompletion === 0) return progress;
  if (daysSinceLastCompletion === 1) { const currentStreak = progress.currentStreak + 1; return { currentStreak, longestStreak: Math.max(progress.longestStreak, currentStreak), freezesRemaining: progress.freezesRemaining }; }
  if (daysSinceLastCompletion === 2 && progress.freezesRemaining > 0) { const currentStreak = progress.currentStreak + 1; return { currentStreak, longestStreak: Math.max(progress.longestStreak, currentStreak), freezesRemaining: progress.freezesRemaining - 1 }; }
  return { currentStreak: 1, longestStreak: Math.max(progress.longestStreak, 1), freezesRemaining: progress.freezesRemaining };
}
function normalizeProgress(value: unknown): PracticeProgress {
  if (!isRecord(value)) return defaultProgress;
  const courierSmsCompleted = value.courierSmsCompleted === true;
  const socialEngineeringCompleted = value.socialEngineeringCompleted === true;
  const executableFileCompleted = value.executableFileCompleted === true;
  const habits = isRecord(value.habits) ? value.habits : {};
  return {
    courierSmsCompleted, socialEngineeringCompleted, executableFileCompleted, modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted), mastery: isMasteryState(value.mastery) ? value.mastery : defaultProgress.mastery, currentStreak: nonNegativeInteger(value.currentStreak), longestStreak: nonNegativeInteger(value.longestStreak), freezesRemaining: Math.min(nonNegativeInteger(value.freezesRemaining), 1), lastQualifyingDate: typeof value.lastQualifyingDate === "string" ? value.lastQualifyingDate : null, lastRetryResult: value.lastRetryResult === "safe" || value.lastRetryResult === "unsafe" ? value.lastRetryResult : null,
    habits: { inspect: habits.inspect === true, verify: habits.verify === true, report: habits.report === true }, badges: Array.isArray(value.badges) ? value.badges.filter((badge): badge is string => typeof badge === "string") : [],
  };
}
function localDateKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function daysBetween(previousDate: string, currentDate: string): number { const previous = Date.parse(`${previousDate}T00:00:00`); const current = Date.parse(`${currentDate}T00:00:00`); return Number.isNaN(previous) || Number.isNaN(current) ? Number.NaN : Math.round((current - previous) / 86_400_000); }
function isMasteryState(value: unknown): value is MasteryState { return typeof value === "string" && masteryStates.includes(value as MasteryState); }
function nonNegativeInteger(value: unknown): number { return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
