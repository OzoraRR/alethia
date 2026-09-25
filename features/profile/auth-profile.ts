"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearActiveSession, getActiveAccountId } from "@/lib/session/session";

export type AuthProfile = {
  id: string;
  email: string;
  username: string;
  mastery: "not_started" | "familiar" | "skilled" | "needs_practice";
  modulesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  createdAt: string | null;
};

export type AuthProfileState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "unavailable" }
  | { status: "authenticated"; profile: AuthProfile; error?: string };

const profileSelect =
  "id, email, username, mastery, modules_completed, current_streak, longest_streak, badges, created_at";

type ProfileRow = {
  id?: unknown;
  email?: unknown;
  username?: unknown;
  mastery?: unknown;
  modules_completed?: unknown;
  current_streak?: unknown;
  longest_streak?: unknown;
  badges?: unknown;
  created_at?: unknown;
};

function isMastery(value: unknown): AuthProfile["mastery"] {
  return value === "familiar" || value === "skilled" || value === "needs_practice"
    ? value
    : "not_started";
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeProfile(row: ProfileRow | null, user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): AuthProfile {
  const metadataUsername =
    typeof user.user_metadata?.username === "string" ? user.user_metadata.username.trim() : "";
  const username = typeof row?.username === "string" && row.username.trim() ? row.username.trim() : metadataUsername;
  const email = typeof row?.email === "string" && row.email.trim()
    ? row.email.trim()
    : (user.email ?? "").trim();
  const fallbackUsername = email.includes("@") ? email.split("@")[0] : "operator";
  const badges = Array.isArray(row?.badges)
    ? row.badges.filter((badge): badge is string => typeof badge === "string")
    : [];

  return {
    id: user.id,
    email,
    username: username || fallbackUsername || "operator",
    mastery: isMastery(row?.mastery),
    modulesCompleted: nonNegativeInteger(row?.modules_completed),
    currentStreak: nonNegativeInteger(row?.current_streak),
    longestStreak: nonNegativeInteger(row?.longest_streak),
    badges,
    createdAt: typeof row?.created_at === "string" ? row.created_at : null,
  };
}

function getClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function isMissingSessionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return (
    code === "auth_session_missing" ||
    candidate.status === 401 ||
    message.includes("auth session missing") ||
    message.includes("no session")
  );
}

export async function loadAuthProfile(): Promise<AuthProfileState> {
  const client = getClient();
  if (!client) return { status: "unavailable" };

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) {
      return isMissingSessionError(userError) ? { status: "anonymous" } : { status: "unavailable" };
    }
    if (
      !userData.user ||
      userData.user.is_anonymous === true ||
      userData.user.app_metadata?.provider === "anonymous"
    ) return { status: "anonymous" };

    const { data, error: profileError } = await client
      .from("profiles")
      .select(profileSelect)
      .eq("id", userData.user.id)
      .maybeSingle();
    const profile = normalizeProfile(data as ProfileRow | null, userData.user);

    if (profileError || !data) {
      return {
        status: "authenticated",
        profile,
        error: profileError?.message ?? "Profile row is unavailable.",
      };
    }

    return { status: "authenticated", profile };
  } catch {
    return { status: "unavailable" };
  }
}

export function useAuthProfile(): {
  state: AuthProfileState;
  profile: AuthProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refresh: () => Promise<AuthProfileState>;
  signOut: () => Promise<{ error: string | null }>;
} {
  const [state, setState] = useState<AuthProfileState>({ status: "loading" });

  const refresh = useCallback(async () => {
    const nextState = await loadAuthProfile();
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    void refresh();

    const client = getClient();
    if (!client) return undefined;

    const { data } = client.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        if (getActiveAccountId()) clearActiveSession();
        setState({ status: "anonymous" });
        return;
      }
      // Supabase warns against awaiting other Supabase calls directly inside
      // an auth callback. Defer the profile query to the next task.
      queueMicrotask(() => {
        void refresh();
      });
    });

    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const client = getClient();
    let error: string | null = null;

    if (client) {
      try {
        const result = await client.auth.signOut();
        if (result.error) error = result.error.message;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "Gagal keluar dari Supabase.";
      }
    }

    // Always clear the local session projection, even if the network request
    // failed, so a stale authenticated context cannot be reused.
    clearActiveSession();
    return { error };
  }, []);

  return {
    state,
    profile: state.status === "authenticated" ? state.profile : null,
    isLoading: state.status === "loading",
    isAuthenticated: state.status === "authenticated",
    error: state.status === "authenticated" ? state.error ?? null : null,
    refresh,
    signOut,
  };
}
