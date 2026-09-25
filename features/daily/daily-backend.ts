"use client";

import { createClient } from "@/lib/supabase/client";

export type DailyQuestStatus = "not_started" | "in_progress" | "completed" | "claimed";
export type DailyQuestType = "daily_login" | "complete_module" | "create_report";

export type DailyQuestAssignment = {
  id: string;
  title: string;
  description: string;
  questType: DailyQuestType;
  position: number;
  questDate: string;
  status: DailyQuestStatus;
  progressValue: number;
  targetValue: number;
  rewardPoints: number;
  completedAt: string | null;
  claimedAt: string | null;
};

export type DailyActivityResult = {
  questDate: string;
  currentStreak: number;
  longestStreak: number;
  points: number;
  newlyAssignedQuests: number;
};

export type InAppNotification = {
  id: string;
  type: "module_completion" | "achievement" | "daily_quest" | "system";
  title: string;
  body: string;
  moduleId: string | null;
  achievementCode: string | null;
  isRead: boolean;
  createdAt: string;
};

export type UserAchievement = {
  code: string;
  awardedAt: string;
};

type QuestRow = {
  quest_id?: unknown;
  quest_date?: unknown;
  status?: unknown;
  progress_value?: unknown;
  target_value?: unknown;
  reward_points?: unknown;
  completed_at?: unknown;
  claimed_at?: unknown;
};

type QuestDefinitionRow = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  quest_type?: unknown;
  position?: unknown;
};

type NormalizedQuestDefinition = {
  id: string;
  title: string;
  description: string;
  questType: DailyQuestType;
  position: number;
};

type NotificationRow = {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  module_id?: unknown;
  achievement_code?: unknown;
  is_read?: unknown;
  created_at?: unknown;
};

type AchievementRow = {
  code?: unknown;
  awarded_at?: unknown;
};

/** Records activity idempotently for the user's current local date. */
export async function recordDailyActivity(): Promise<DailyActivityResult | null> {
  const client = getClient();
  if (!client) return null;

  const result = await client.rpc("record_daily_activity", {
    requested_timezone: getBrowserTimezone(),
  });
  if (result.error) {
    console.warn(`[Alethia] daily activity was not synchronized (${errorCode(result.error)}).`);
    return null;
  }
  return normalizeActivityResult(result.data);
}

export async function loadDailyQuests(questDate: string): Promise<DailyQuestAssignment[]> {
  const client = getClient();
  if (!client) return [];

  const [assignmentResult, definitionResult] = await Promise.all([
    client
      .from("user_daily_quests")
      .select("quest_id, quest_date, status, progress_value, target_value, reward_points, completed_at, claimed_at")
      .eq("quest_date", questDate)
      .order("quest_id", { ascending: true }),
    client
      .from("daily_quests")
      .select("id, title, description, quest_type, position")
      .eq("is_active", true)
      .order("position", { ascending: true }),
  ]);

  if (assignmentResult.error) {
    console.warn(`[Alethia] daily quests were not loaded (${errorCode(assignmentResult.error)}).`);
    return [];
  }
  if (definitionResult.error) {
    console.warn(`[Alethia] daily quest definitions were not loaded (${errorCode(definitionResult.error)}).`);
    return [];
  }

  const definitions = new Map<string, NormalizedQuestDefinition>(
    ((definitionResult.data ?? []) as QuestDefinitionRow[])
      .map(normalizeQuestDefinition)
      .filter((definition): definition is NormalizedQuestDefinition => definition !== null)
      .map((definition) => [definition.id, definition]),
  );

  return ((assignmentResult.data ?? []) as QuestRow[])
    .map((row) => {
      const assignment = normalizeQuestAssignment(row);
      if (!assignment) return null;
      const definition = definitions.get(assignment.id);
      return {
        ...assignment,
        title: definition?.title ?? assignment.id.replaceAll("-", " "),
        description: definition?.description ?? "Quest harian dari database.",
        questType: definition?.questType ?? inferQuestType(assignment.id),
        position: definition?.position ?? 999,
      } satisfies DailyQuestAssignment;
    })
    .filter((quest): quest is DailyQuestAssignment => quest !== null)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

export async function claimDailyQuest(
  questId: string,
  questDate: string,
): Promise<{ status: DailyQuestStatus; rewardPoints: number; totalPoints: number } | null> {
  const client = getClient();
  if (!client) return null;

  const result = await client.rpc("claim_daily_quest", {
    requested_quest_id: questId,
    requested_quest_date: questDate,
  });
  if (result.error) {
    console.warn(`[Alethia] daily quest was not claimed (${errorCode(result.error)}).`);
    return null;
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!isRecord(row) || !isQuestStatus(row.status)) return null;
  return {
    status: row.status,
    rewardPoints: nonNegativeInteger(row.reward_points),
    totalPoints: nonNegativeInteger(row.total_points),
  };
}

export async function loadNotifications(unreadOnly = false): Promise<InAppNotification[]> {
  const client = getClient();
  if (!client) return [];

  let request = client
    .from("notifications")
    .select("id, type, title, body, module_id, achievement_code, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (unreadOnly) request = request.eq("is_read", false);

  const result = await request;
  if (result.error) {
    console.warn(`[Alethia] notifications were not loaded (${errorCode(result.error)}).`);
    return [];
  }

  return ((result.data ?? []) as NotificationRow[])
    .map(normalizeNotification)
    .filter((notification): notification is InAppNotification => notification !== null);
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const result = await client.rpc("mark_notification_read", {
    requested_notification_id: notificationId,
  });
  if (result.error) {
    console.warn(`[Alethia] notification was not updated (${errorCode(result.error)}).`);
    return false;
  }
  return result.data === true;
}

export async function loadAchievements(): Promise<UserAchievement[]> {
  const client = getClient();
  if (!client) return [];
  const result = await client
    .from("user_achievements")
    .select("code, awarded_at")
    .order("awarded_at", { ascending: false });
  if (result.error) {
    console.warn(`[Alethia] achievements were not loaded (${errorCode(result.error)}).`);
    return [];
  }
  return ((result.data ?? []) as AchievementRow[])
    .map((row) => {
      const code = typeof row.code === "string" ? row.code : null;
      const awardedAt = typeof row.awarded_at === "string" ? row.awarded_at : null;
      return code && awardedAt ? { code, awardedAt } : null;
    })
    .filter((achievement): achievement is UserAchievement => achievement !== null);
}

function getClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
}

function normalizeActivityResult(value: unknown): DailyActivityResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) return null;
  const questDate = typeof row.quest_date === "string" ? row.quest_date : null;
  if (!questDate) return null;
  return {
    questDate,
    currentStreak: nonNegativeInteger(row.current_streak),
    longestStreak: nonNegativeInteger(row.longest_streak),
    points: nonNegativeInteger(row.points),
    newlyAssignedQuests: nonNegativeInteger(row.newly_assigned_quests),
  };
}

function normalizeQuestAssignment(value: QuestRow): Omit<DailyQuestAssignment, "title" | "description" | "questType" | "position"> | null {
  const id = typeof value.quest_id === "string" ? value.quest_id : null;
  const questDate = typeof value.quest_date === "string" ? value.quest_date : null;
  if (!id || !questDate || !isQuestStatus(value.status)) return null;
  return {
    id,
    questDate,
    status: value.status,
    progressValue: nonNegativeInteger(value.progress_value),
    targetValue: nonNegativeInteger(value.target_value),
    rewardPoints: nonNegativeInteger(value.reward_points),
    completedAt: nullableString(value.completed_at),
    claimedAt: nullableString(value.claimed_at),
  };
}

function normalizeQuestDefinition(value: QuestDefinitionRow): NormalizedQuestDefinition | null {
  const id = typeof value.id === "string" ? value.id : null;
  const title = typeof value.title === "string" ? value.title : null;
  const description = typeof value.description === "string" ? value.description : null;
  if (!id || !title || !description || !isQuestType(value.quest_type)) return null;
  return {
    id,
    title,
    description,
    questType: value.quest_type,
    position: nonNegativeInteger(value.position),
  };
}

function inferQuestType(id: string): DailyQuestType {
  if (id === "complete-one-module") return "complete_module";
  if (id === "submit-one-report") return "create_report";
  return "daily_login";
}

function normalizeNotification(value: NotificationRow): InAppNotification | null {
  const id = typeof value.id === "string" ? value.id : null;
  const title = typeof value.title === "string" ? value.title : null;
  const body = typeof value.body === "string" ? value.body : null;
  const createdAt = nullableString(value.created_at);
  if (!id || !title || !body || !createdAt || !isNotificationType(value.type)) return null;
  return {
    id,
    type: value.type,
    title,
    body,
    moduleId: nullableString(value.module_id),
    achievementCode: nullableString(value.achievement_code),
    isRead: value.is_read === true,
    createdAt,
  };
}

function isQuestStatus(value: unknown): value is DailyQuestStatus {
  return value === "not_started" || value === "in_progress" || value === "completed" || value === "claimed";
}

function isQuestType(value: unknown): value is DailyQuestType {
  return value === "daily_login" || value === "complete_module" || value === "create_report";
}

function isNotificationType(value: unknown): value is InAppNotification["type"] {
  return value === "module_completion" || value === "achievement" || value === "daily_quest" || value === "system";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
}
