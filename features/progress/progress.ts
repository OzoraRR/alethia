"use client";

import { useEffect, useState } from "react";
import type { Decision } from "@/features/simulation/types";

export const masteryStates = ["not_started", "familiar", "skilled", "needs_practice"] as const;
export type MasteryState = (typeof masteryStates)[number];
export type RetryResult = "safe" | "unsafe" | null;

export type PracticeProgress = {
  courierSmsCompleted: boolean;
  modulesCompleted: number;
  mastery: MasteryState;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining: number;
  lastQualifyingDate: string | null;
  lastRetryResult: RetryResult;
  habits: {
    inspect: boolean;
    verify: boolean;
    report: boolean;
  };
  badges: string[];
};

const progressStorageKey = "alethia:practice-progress:v1";

export const defaultProgress: PracticeProgress = {
  courierSmsCompleted: false,
  modulesCompleted: 0,
  mastery: "not_started",
  currentStreak: 0,
  longestStreak: 0,
  freezesRemaining: 1,
  lastQualifyingDate: null,
  lastRetryResult: null,
  habits: {
    inspect: false,
    verify: false,
    report: false,
  },
  badges: [],
};

export function loadProgress(): PracticeProgress {
  if (typeof window === "undefined") {
    return defaultProgress;
  }

  try {
    const storage = window.localStorage;
    const storedProgress = storage.getItem(progressStorageKey);
    return storedProgress ? normalizeProgress(JSON.parse(storedProgress) as unknown) : defaultProgress;
  } catch {
    return defaultProgress;
  }
}

export function saveProgress(progress: PracticeProgress): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  } catch {
    // Local progress is helpful but must never block the simulation.
  }
}

export function recordCourierSmsCompletion({
  retryDecision,
  completedAt = localDateKey(),
}: {
  retryDecision: Decision;
  completedAt?: string;
}): PracticeProgress {
  const currentProgress = loadProgress();
  const isFirstCompletion = !currentProgress.courierSmsCompleted;
  const nextStreak = calculateNextStreak(currentProgress, completedAt);
  const nextMastery = isFirstCompletion
    ? "familiar"
    : retryDecision === "open_link"
      ? "needs_practice"
      : "skilled";
  const nextProgress: PracticeProgress = {
    ...currentProgress,
    courierSmsCompleted: true,
    modulesCompleted: 1,
    mastery: nextMastery,
    currentStreak: nextStreak.currentStreak,
    longestStreak: nextStreak.longestStreak,
    freezesRemaining: nextStreak.freezesRemaining,
    lastQualifyingDate: completedAt,
    lastRetryResult: retryDecision === "open_link" ? "unsafe" : "safe",
    habits: {
      inspect: true,
      verify: true,
      report: currentProgress.habits.report || retryDecision === "report_delete",
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
    setProgress(loadProgress());
  }, []);

  return progress;
}

function calculateNextStreak(progress: PracticeProgress, completedAt: string) {
  if (!progress.lastQualifyingDate) {
    return { currentStreak: 1, longestStreak: Math.max(progress.longestStreak, 1), freezesRemaining: progress.freezesRemaining };
  }

  const daysSinceLastCompletion = daysBetween(progress.lastQualifyingDate, completedAt);
  if (daysSinceLastCompletion === 0) {
    return progress;
  }

  if (daysSinceLastCompletion === 1) {
    const currentStreak = progress.currentStreak + 1;
    return { currentStreak, longestStreak: Math.max(progress.longestStreak, currentStreak), freezesRemaining: progress.freezesRemaining };
  }

  if (daysSinceLastCompletion === 2 && progress.freezesRemaining > 0) {
    const currentStreak = progress.currentStreak + 1;
    return { currentStreak, longestStreak: Math.max(progress.longestStreak, currentStreak), freezesRemaining: progress.freezesRemaining - 1 };
  }

  return { currentStreak: 1, longestStreak: Math.max(progress.longestStreak, 1), freezesRemaining: progress.freezesRemaining };
}

function normalizeProgress(value: unknown): PracticeProgress {
  if (!isRecord(value)) {
    return defaultProgress;
  }

  const courierSmsCompleted = value.courierSmsCompleted === true;
  const mastery = isMasteryState(value.mastery) ? value.mastery : defaultProgress.mastery;
  const lastRetryResult = value.lastRetryResult === "safe" || value.lastRetryResult === "unsafe" ? value.lastRetryResult : null;
  const habits = isRecord(value.habits) ? value.habits : {};
  const badges = Array.isArray(value.badges) ? value.badges.filter((badge): badge is string => typeof badge === "string") : [];

  return {
    courierSmsCompleted,
    modulesCompleted: courierSmsCompleted ? 1 : 0,
    mastery,
    currentStreak: nonNegativeInteger(value.currentStreak),
    longestStreak: nonNegativeInteger(value.longestStreak),
    freezesRemaining: Math.min(nonNegativeInteger(value.freezesRemaining), 1),
    lastQualifyingDate: typeof value.lastQualifyingDate === "string" ? value.lastQualifyingDate : null,
    lastRetryResult,
    habits: {
      inspect: habits.inspect === true,
      verify: habits.verify === true,
      report: habits.report === true,
    },
    badges,
  };
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(previousDate: string, currentDate: string): number {
  const previous = Date.parse(`${previousDate}T00:00:00`);
  const current = Date.parse(`${currentDate}T00:00:00`);
  return Number.isNaN(previous) || Number.isNaN(current) ? Number.NaN : Math.round((current - previous) / 86_400_000);
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

