"use client";

import { createClient } from "@/lib/supabase/client";
import type { MasteryState, PracticeProgress, RetryResult } from "./progress";

export const practiceEventTypes = [
  "module_started",
  "stage_viewed",
  "sender_inspected",
  "link_inspected",
  "official_channel_verified",
  "decision_selected",
  "attacker_pov_viewed",
  "feedback_viewed",
  "retry_started",
  "module_completed",
  "locale_changed",
] as const;

export type PracticeEventType = (typeof practiceEventTypes)[number];
export type PracticeEventMetadata = Readonly<Record<string, string>>;

export type RemoteProgress = {
  courierSmsCompleted: boolean;
  modulesCompleted: number;
  mastery: MasteryState;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining: number;
  lastQualifyingDate: string | null;
  lastRetryResult: RetryResult;
  habits: PracticeProgress["habits"];
  badges: string[];
};

type AuthContext = {
  client: NonNullable<ReturnType<typeof createClient>>;
  userId: string;
};

let anonymousUserPromise: Promise<string | null> | null = null;

export async function startPracticeAttempt(): Promise<string | null> {
  const auth = await getAuthContext();
  if (!auth) {
    return null;
  }

  await ensureProfile(auth);

  const { data, error } = await auth.client
    .from("practice_attempts")
    .insert({
      user_id: auth.userId,
      module_id: "courier-sms",
      variant_id: "primary",
    })
    .select("id")
    .single();

  return error || !data ? null : data.id;
}

export async function loadRemoteProgress(): Promise<RemoteProgress | null> {
  const auth = await getAuthContext();
  if (!auth) {
    return null;
  }

  const [moduleResult, streakResult, attemptResult, achievementResult] = await Promise.all([
    auth.client
      .from("user_module_progress")
      .select("status, mastery_level, last_practised_at, inspect_practised, verify_practised, report_practised")
      .eq("user_id", auth.userId)
      .eq("module_id", "courier-sms")
      .maybeSingle(),
    auth.client
      .from("user_streaks")
      .select("current_streak, longest_streak, freezes_remaining, last_qualifying_date")
      .eq("user_id", auth.userId)
      .maybeSingle(),
    auth.client
      .from("practice_attempts")
      .select("outcome, completed_at")
      .eq("user_id", auth.userId)
      .eq("module_id", "courier-sms")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1),
    auth.client
      .from("user_achievements")
      .select("code")
      .eq("user_id", auth.userId),
  ]);

  if (moduleResult.error || streakResult.error || attemptResult.error || achievementResult.error) {
    return null;
  }

  const moduleProgress = moduleResult.data;
  const streak = streakResult.data;
  const latestAttempt = attemptResult.data?.[0];
  const badges = (achievementResult.data ?? [])
    .map((achievement: { code: unknown }) => achievement.code)
    .filter((code: unknown): code is string => typeof code === "string");

  if (!moduleProgress && !streak && !latestAttempt && badges.length === 0) {
    return null;
  }

  const courierSmsCompleted = moduleProgress?.status === "completed";
  return {
    courierSmsCompleted,
    modulesCompleted: courierSmsCompleted ? 1 : 0,
    mastery: isMasteryState(moduleProgress?.mastery_level) ? moduleProgress.mastery_level : "not_started",
    currentStreak: nonNegativeInteger(streak?.current_streak),
    longestStreak: nonNegativeInteger(streak?.longest_streak),
    freezesRemaining: Math.min(nonNegativeInteger(streak?.freezes_remaining), 1),
    lastQualifyingDate: typeof streak?.last_qualifying_date === "string" ? streak.last_qualifying_date : null,
    lastRetryResult: retryResultFromOutcome(latestAttempt?.outcome),
    habits: {
      inspect: moduleProgress?.inspect_practised === true,
      verify: moduleProgress?.verify_practised === true,
      report: moduleProgress?.report_practised === true,
    },
    badges,
  };
}

export async function persistProgressSnapshot({
  progress,
  attemptId,
}: {
  progress: PracticeProgress;
  attemptId?: string | null;
}): Promise<void> {
  const auth = await getAuthContext();
  if (!auth) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const writes: PromiseLike<unknown>[] = [
    ensureProfile(auth),
    auth.client.from("user_module_progress").upsert(
      {
        user_id: auth.userId,
        module_id: "courier-sms",
        status: "completed",
        mastery_level: progress.mastery,
        last_practised_at: occurredAt,
        inspect_practised: progress.habits.inspect,
        verify_practised: progress.habits.verify,
        report_practised: progress.habits.report,
      },
      { onConflict: "user_id,module_id" },
    ),
    auth.client.from("user_streaks").upsert(
      {
        user_id: auth.userId,
        current_streak: progress.currentStreak,
        longest_streak: progress.longestStreak,
        freezes_remaining: progress.freezesRemaining,
        last_qualifying_date: progress.lastQualifyingDate,
        updated_at: occurredAt,
      },
      { onConflict: "user_id" },
    ),
  ];

  if (progress.badges.includes("first_practice")) {
    writes.push(
      auth.client.from("user_achievements").upsert(
        { user_id: auth.userId, code: "first_practice" },
        { onConflict: "user_id,code" },
      ),
    );
  }

  if (attemptId) {
    writes.push(
      auth.client
        .from("practice_attempts")
        .update({
          completed_at: occurredAt,
          outcome: outcomeFromRetryResult(progress.lastRetryResult),
        })
        .eq("id", attemptId)
        .eq("user_id", auth.userId),
    );
  }

  await Promise.all(writes);
}

export async function persistPracticeEvent({
  attemptId,
  eventType,
  stage,
  metadata = {},
}: {
  attemptId: string | null;
  eventType: PracticeEventType;
  stage: string;
  metadata?: PracticeEventMetadata;
}): Promise<void> {
  if (!attemptId) {
    return;
  }

  const auth = await getAuthContext();
  if (!auth) {
    return;
  }

  await auth.client.from("practice_events").insert({
    attempt_id: attemptId,
    event_type: eventType,
    stage,
    metadata_json: metadata,
  });
}

async function getAuthContext(): Promise<AuthContext | null> {
  const client = getSafeClient();
  if (!client) {
    return null;
  }

  const userId = await getOrCreateAnonymousUser(client);
  return userId ? { client, userId } : null;
}

function getSafeClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

async function getOrCreateAnonymousUser(client: NonNullable<ReturnType<typeof createClient>>): Promise<string | null> {
  if (!anonymousUserPromise) {
    anonymousUserPromise = (async () => {
      const { data } = await client.auth.getUser();
      if (data.user?.id) {
        return data.user.id;
      }

      const { data: anonymousData, error } = await client.auth.signInAnonymously();
      return error ? null : anonymousData.user?.id ?? null;
    })().catch(() => null);
  }

  return anonymousUserPromise;
}

async function ensureProfile(auth: AuthContext): Promise<void> {
  await auth.client.from("profiles").upsert(
    { id: auth.userId, preferred_locale: "id" },
    { onConflict: "id", ignoreDuplicates: true },
  );
}

function outcomeFromRetryResult(result: RetryResult): "safe" | "unsafe" | "completed" {
  return result === "unsafe" || result === "safe" ? result : "completed";
}

function retryResultFromOutcome(value: unknown): RetryResult {
  return value === "safe" || value === "unsafe" ? value : null;
}

function isMasteryState(value: unknown): value is MasteryState {
  return value === "not_started" || value === "familiar" || value === "skilled" || value === "needs_practice";
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
