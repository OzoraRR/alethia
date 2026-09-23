"use client";

import type { PracticeProgress } from "../progress/progress";

export type ActivityLevel = 0 | 1 | 2 | 3;

export type ActivityDay = {
  dateKey: string;
  level: ActivityLevel;
  count: number;
};

export type ActivityGrid = {
  weeks: ActivityDay[][];
  total: number;
  activeDays: number;
};

const DAY_MS = 86_400_000;
const DEFAULT_WEEKS = 18;

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(key: string): number {
  const time = Date.parse(`${key}T00:00:00`);
  return Number.isNaN(time) ? NaN : time;
}

function activeDateKeys(progress: PracticeProgress): Map<string, number> {
  const counts = new Map<string, number>();
  if (!progress.lastQualifyingDate) return counts;
  const lastTime = parseDateKey(progress.lastQualifyingDate);
  if (Number.isNaN(lastTime)) return counts;

  const streakDays = Math.max(1, Math.min(progress.currentStreak || 1, 365));
  for (let offset = 0; offset < streakDays; offset += 1) {
    const d = new Date(lastTime - offset * DAY_MS);
    counts.set(toDateKey(d), 1);
  }

  // Completed modules add intensity to the qualifying day.
  const bonus = progress.modulesCompleted > 1 ? 2 : progress.modulesCompleted === 1 ? 1 : 0;
  const existing = counts.get(progress.lastQualifyingDate) ?? 0;
  counts.set(progress.lastQualifyingDate, existing + bonus);
  return counts;
}

function levelForCount(count: number, isLatest: boolean): ActivityLevel {
  if (count <= 0) return 0;
  if (count >= 3 || (isLatest && count >= 2)) return 3;
  if (count >= 2) return 2;
  return 1;
}

export function buildActivityGrid(
  progress: PracticeProgress,
  today = new Date(),
  weeks = DEFAULT_WEEKS,
): ActivityGrid {
  const totalDays = Math.max(7, weeks * 7);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTime = end.getTime() - (totalDays - 1) * DAY_MS;
  // Align start to Monday for a stable GitHub-like grid.
  const startDay = new Date(startTime).getDay(); // 0 Sun .. 6 Sat
  const mondayOffset = (startDay + 6) % 7;
  const alignedStart = startTime - mondayOffset * DAY_MS;

  const counts = activeDateKeys(progress);
  const days: ActivityDay[] = [];
  // 7 columns per week row would need 7*weeks cells; keep grid rectangular.
  const cells = weeks * 7;
  for (let i = 0; i < cells; i += 1) {
    const d = new Date(alignedStart + i * DAY_MS);
    if (d.getTime() > end.getTime()) break;
    const dateKey = toDateKey(d);
    const count = counts.get(dateKey) ?? 0;
    days.push({ dateKey, level: levelForCount(count, dateKey === progress.lastQualifyingDate), count });
  }

  const weekRows: ActivityDay[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    weekRows.push(days.slice(w * 7, w * 7 + 7));
  }

  const total = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
  return { weeks: weekRows, total, activeDays: counts.size };
}

export type ProfileReport = {
  id: string;
  title: string;
  meta: string;
  status: string;
  detail: string;
  done: boolean;
};

export function getReportActivity(
  progress: PracticeProgress,
  copy: {
    courierTitle: string;
    socialTitle: string;
    completed: string;
    pending: string;
    reportHabit: string;
  },
): ProfileReport[] {
  const reports: ProfileReport[] = [];
  reports.push({
    id: "courier-sms",
    title: copy.courierTitle,
    meta: "MODULE 01 · SMS PHISHING",
    status: progress.courierSmsCompleted ? copy.completed : copy.pending,
    detail: progress.courierSmsCompleted
      ? `Inspect ${progress.habits.inspect ? "✓" : "·"} · Verify ${progress.habits.verify ? "✓" : "·"} · Report ${progress.habits.report ? "✓" : "·"}`
      : copy.reportHabit,
    done: progress.courierSmsCompleted,
  });
  reports.push({
    id: "social-engineering",
    title: copy.socialTitle,
    meta: "MODULE 02 · SOCIAL ENGINEERING",
    status: progress.socialEngineeringCompleted ? copy.completed : copy.pending,
    detail: progress.socialEngineeringCompleted
      ? `Inspect ${progress.habits.inspect ? "✓" : "·"} · Verify ${progress.habits.verify ? "✓" : "·"} · Report ${progress.habits.report ? "✓" : "·"}`
      : copy.reportHabit,
    done: progress.socialEngineeringCompleted,
  });
  return reports;
}
