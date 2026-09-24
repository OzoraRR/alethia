"use client";

import { createClient } from "../../lib/supabase/client";
import { getOrCreateAnonymousSession } from "../../lib/session/session";
import type { MasteryState, ModuleId, PracticeProgress, RetryResult } from "./progress";

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
export type RemoteSyncResult = { status: "synced" | "local_only"; reason?: "no_session" | "remote_error" };
export type PracticeAttemptResult = RemoteSyncResult & { attemptId: string | null };
export type RemoteProgress = {
  courierSmsCompleted: boolean;
  socialEngineeringCompleted: boolean;
  executableFileCompleted?: boolean;
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
type AuthContext = { client: NonNullable<ReturnType<typeof createClient>>; userId: string };
type QueryResult = { error: unknown | null };
type SingleDataResult<T> = { data: T | null; error: unknown };
type ModuleProgressRow = {
  module_id: string;
  status: string;
  mastery_level: unknown;
  last_practised_at: string | null;
  inspect_practised: unknown;
  verify_practised: unknown;
  report_practised: unknown;
};

const REQUEST_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase request timeout")), ms),
    ),
  ]);
}

export async function startPracticeAttempt(
  moduleId: ModuleId = "courier-sms",
): Promise<PracticeAttemptResult> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { attemptId: null, ...localOnly("no_session") };

    const profileResult = await ensureProfile(auth);
    if (profileResult.status === "local_only") return { attemptId: null, ...profileResult };

    const { data, error } = await withTimeout<SingleDataResult<{ id: string }>>(
      auth.client
        .from("practice_attempts")
        .insert({ user_id: auth.userId, module_id: moduleId, variant_id: "primary" })
        .select("id")
        .single(),
    );

    if (error || !data) {
      logSyncFailure("create practice attempt", error);
      return { attemptId: null, ...localOnly("remote_error") };
    }
    return { attemptId: data.id, status: "synced" };
  } catch (error) {
    logSyncFailure("create practice attempt", error);
    return { attemptId: null, ...localOnly("remote_error") };
  }
}

export async function loadRemoteProgress(): Promise<RemoteProgress | null> {
  try {
    const auth = await getAuthContext();
    if (!auth) return null;

    const [moduleResult, streakResult, attemptResult, achievementResult] = (await withTimeout(
      Promise.all([
        auth.client
          .from("user_module_progress")
          .select("module_id, status, mastery_level, last_practised_at, inspect_practised, verify_practised, report_practised")
          .eq("user_id", auth.userId),
        auth.client
          .from("user_streaks")
          .select("current_streak, longest_streak, freezes_remaining, last_qualifying_date")
          .eq("user_id", auth.userId)
          .maybeSingle(),
        auth.client
          .from("practice_attempts")
          .select("outcome, completed_at")
          .eq("user_id", auth.userId)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1),
        auth.client.from("user_achievements").select("code").eq("user_id", auth.userId),
      ]),
    )) as [
      { data: ModuleProgressRow[] | null; error: unknown },
      { data: { current_streak: unknown; longest_streak: unknown; freezes_remaining: unknown; last_qualifying_date: unknown } | null; error: unknown },
      { data: Array<{ outcome: unknown; completed_at: unknown }> | null; error: unknown },
      { data: Array<{ code: unknown }> | null; error: unknown },
    ];

    if (moduleResult.error || streakResult.error || attemptResult.error || achievementResult.error) {
      logSyncFailure(
        "load progress",
        moduleResult.error ?? streakResult.error ?? attemptResult.error ?? achievementResult.error,
      );
      return null;
    }

    const moduleProgresses = (moduleResult.data ?? []) as ModuleProgressRow[];
    const courierProgress = moduleProgresses.find((row) => row.module_id === "courier-sms");
    const socialProgress = moduleProgresses.find((row) => row.module_id === "social-engineering");
    const executableFileProgress = moduleProgresses.find((row) => row.module_id === "executable-file");
    const streak = streakResult.data;
    const latestAttempt = attemptResult.data?.[0];
    const badges = (achievementResult.data ?? [])
      .map((achievement: { code: unknown }) => achievement.code)
      .filter((code: unknown): code is string => typeof code === "string");
    const courierSmsCompleted = courierProgress?.status === "completed";
    const socialEngineeringCompleted = socialProgress?.status === "completed";
    const executableFileCompleted = executableFileProgress?.status === "completed";

    if (!courierProgress && !socialProgress && !executableFileProgress && !streak && !latestAttempt && badges.length === 0) {
      return null;
    }

    return {
      courierSmsCompleted,
      socialEngineeringCompleted,
      executableFileCompleted,
      modulesCompleted: Number(courierSmsCompleted) + Number(socialEngineeringCompleted) + Number(executableFileCompleted),
      mastery: isMasteryState(courierProgress?.mastery_level)
        ? courierProgress.mastery_level
        : "not_started",
      currentStreak: nonNegativeInteger(streak?.current_streak),
      longestStreak: nonNegativeInteger(streak?.longest_streak),
      freezesRemaining: Math.min(nonNegativeInteger(streak?.freezes_remaining), 1),
      lastQualifyingDate:
        typeof streak?.last_qualifying_date === "string" ? streak.last_qualifying_date : null,
      lastRetryResult: retryResultFromOutcome(latestAttempt?.outcome),
      habits: {
        inspect: courierProgress?.inspect_practised === true,
        verify: courierProgress?.verify_practised === true,
        report: courierProgress?.report_practised === true,
      },
      badges,
    };
  } catch (error) {
    logSyncFailure("load progress", error);
    return null;
  }
}

export async function persistProgressSnapshot({
  progress,
  moduleId,
  attemptId,
}: {
  progress: PracticeProgress;
  moduleId: ModuleId;
  attemptId?: string | null;
}): Promise<RemoteSyncResult> {
  try {
    const auth = await getAuthContext();
    if (!auth) return localOnly("no_session");

    const occurredAt = new Date().toISOString();
    const writes: Array<Promise<RemoteSyncResult>> = [
      ensureProfile(auth),
      inspectMutation(
        "update module progress",
        auth.client.from("user_module_progress").upsert(
          {
            user_id: auth.userId,
            module_id: moduleId,
            status: "completed",
            mastery_level: moduleId === "courier-sms" ? progress.mastery : "not_started",
            last_practised_at: occurredAt,
            inspect_practised: progress.habits.inspect,
            verify_practised: progress.habits.verify,
            report_practised: progress.habits.report,
          },
          { onConflict: "user_id,module_id" },
        ),
      ),
      inspectMutation(
        "update streak",
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
      ),
    ];

    if (progress.badges.includes("first_practice")) {
      writes.push(
        inspectMutation(
          "update achievement",
          auth.client
            .from("user_achievements")
            .upsert({ user_id: auth.userId, code: "first_practice" }, { onConflict: "user_id,code" }),
        ),
      );
    }

    if (attemptId) {
      writes.push(
        inspectMutation(
          "complete practice attempt",
          auth.client
            .from("practice_attempts")
            .update({ completed_at: occurredAt, outcome: outcomeFromRetryResult(progress.lastRetryResult) })
            .eq("id", attemptId)
            .eq("user_id", auth.userId),
        ),
      );
    }

    const results = await withTimeout(Promise.all(writes));
    return results.every((result) => result.status === "synced")
      ? { status: "synced" }
      : localOnly("remote_error");
  } catch (error) {
    logSyncFailure("persist progress snapshot", error);
    return localOnly("remote_error");
  }
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
}): Promise<RemoteSyncResult> {
  if (!attemptId) return localOnly("no_session");
  try {
    const auth = await getAuthContext();
    if (!auth) return localOnly("no_session");

    return await inspectMutation(
      "record practice event",
      auth.client.from("practice_events").insert({
        attempt_id: attemptId,
        event_type: eventType,
        stage,
        metadata_json: metadata,
      }),
    );
  } catch (error) {
    logSyncFailure("record practice event", error);
    return localOnly("remote_error");
  }
}

async function getAuthContext(): Promise<AuthContext | null> {
  const client = getSafeClient();
  if (!client) return null;
  const session = await getOrCreateAnonymousSession();
  if (session && session.isRemote) {
    return { client, userId: session.sessionId };
  }
  return null;
}

function getSafeClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

async function ensureProfile(auth: AuthContext): Promise<RemoteSyncResult> {
  return inspectMutation(
    "ensure profile",
    auth.client
      .from("profiles")
      .upsert({ id: auth.userId, preferred_locale: "id" }, { onConflict: "id", ignoreDuplicates: true }),
  );
}

async function inspectMutation(
  operation: string,
  request: PromiseLike<QueryResult>,
): Promise<RemoteSyncResult> {
  try {
    const { error } = await withTimeout(request);
    if (!error) return { status: "synced" };
    logSyncFailure(operation, error);
    return localOnly("remote_error");
  } catch (err) {
    logSyncFailure(operation, err);
    return localOnly("remote_error");
  }
}

function localOnly(reason: "no_session" | "remote_error"): RemoteSyncResult {
  return { status: "local_only", reason };
}

function logSyncFailure(operation: string, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "unknown";
  console.warn(`[Alethia] ${operation} was not synchronized (${code}).`);
}

function outcomeFromRetryResult(result: RetryResult): "safe" | "unsafe" | "completed" {
  return result === "unsafe" || result === "safe" ? result : "completed";
}

function retryResultFromOutcome(value: unknown): RetryResult {
  return value === "safe" || value === "unsafe" ? value : null;
}

function isMasteryState(value: unknown): value is MasteryState {
  return (
    value === "not_started" ||
    value === "familiar" ||
    value === "skilled" ||
    value === "needs_practice"
  );
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
