"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateAnonymousSession } from "@/lib/session/session";
import {
  claimDailyQuest,
  loadAchievements,
  loadDailyQuests,
  loadNotifications,
  markNotificationRead,
  recordDailyActivity,
  type DailyActivityResult,
  type DailyQuestAssignment,
  type DailyQuestStatus,
  type InAppNotification,
  type UserAchievement,
} from "./daily-backend";

type DailyActivityContextValue = {
  activity: DailyActivityResult | null;
  quests: DailyQuestAssignment[];
  notifications: InAppNotification[];
  achievements: UserAchievement[];
  loading: boolean;
  claimingQuestId: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  claimQuest: (questId: string, questDate: string) => Promise<{ status: DailyQuestStatus; rewardPoints: number; totalPoints: number } | null>;
  markRead: (notificationId: string) => Promise<boolean>;
};

const DailyActivityContext = createContext<DailyActivityContextValue | null>(null);

export function DailyActivityProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<DailyActivityResult | null>(null);
  const [quests, setQuests] = useState<DailyQuestAssignment[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncPromise = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (syncPromise.current) return syncPromise.current;
    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        await getOrCreateAnonymousSession();
        const nextActivity = await recordDailyActivity();
        if (!nextActivity) return;
        const [nextQuests, nextNotifications, nextAchievements] = await Promise.all([
          loadDailyQuests(nextActivity.questDate),
          loadNotifications(true),
          loadAchievements(),
        ]);
        setActivity(nextActivity);
        setQuests(nextQuests);
        setNotifications(nextNotifications);
        setAchievements(nextAchievements);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Daily state gagal dimuat.");
      } finally {
        setLoading(false);
      }
    })();
    syncPromise.current = request;
    try {
      await request;
    } finally {
      syncPromise.current = null;
    }
  }, []);

  const claimQuest = useCallback(
    async (questId: string, questDate: string) => {
      setClaimingQuestId(questId);
      setError(null);
      try {
        const result = await claimDailyQuest(questId, questDate);
        if (result) await refresh();
        return result;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Reward quest gagal diklaim.");
        return null;
      } finally {
        setClaimingQuestId(null);
      }
    },
    [refresh],
  );

  const markRead = useCallback(async (notificationId: string) => {
    const result = await markNotificationRead(notificationId);
    if (result) {
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    }
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      await refresh();
      if (!cancelled) {
        window.addEventListener("focus", sync);
        document.addEventListener("visibilitychange", handleVisibility);
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void refresh();
    }

    void sync();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const value = useMemo<DailyActivityContextValue>(
    () => ({ activity, quests, notifications, achievements, loading, claimingQuestId, error, refresh, claimQuest, markRead }),
    [activity, quests, notifications, achievements, loading, claimingQuestId, error, refresh, claimQuest, markRead],
  );

  return <DailyActivityContext.Provider value={value}>{children}</DailyActivityContext.Provider>;
}

export function useDailyActivity(): DailyActivityContextValue {
  const value = useContext(DailyActivityContext);
  if (!value) throw new Error("useDailyActivity must be used within DailyActivityProvider");
  return value;
}
