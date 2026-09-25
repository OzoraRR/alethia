"use client";

import { useEffect, useState } from "react";
import { createClient } from "../supabase/client";
import { safeGetItem, safeSetItem, safeRemoveItem, STORAGE_KEYS } from "../storage/safe-storage";

export type SessionData = {
  sessionId: string;
  isAnonymous: boolean;
  isRemote: boolean;
  createdAt: string;
  lastActiveAt: string;
};

let cachedSession: SessionData | null = null;
let sessionPromise: Promise<SessionData> | null = null;
let sessionEpoch = 0;

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createClient>>;

function generateLocalAnonymousId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `anon_${crypto.randomUUID()}`;
  }
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `anon_${randomPart}${timePart}`;
}

function isSessionData(value: unknown): value is SessionData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.isAnonymous === "boolean" &&
    typeof candidate.createdAt === "string"
  );
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 4000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase auth timeout")), ms),
    ),
  ]);
}

async function discardStaleAnonymousUser(
  client: SupabaseBrowserClient,
  userId: string,
): Promise<void> {
  try {
    const { data } = await client.auth.getUser();
    if (data.user?.id === userId && data.user.is_anonymous) {
      await client.auth.signOut();
    }
  } catch {
    // The auth client will reconcile the session on its next request.
  }
}

function makeLocalSession(now: string, stored?: SessionData | null): SessionData {
  if (stored) {
    return {
      ...stored,
      lastActiveAt: now,
    };
  }

  return {
    sessionId: generateLocalAnonymousId(),
    isAnonymous: true,
    isRemote: false,
    createdAt: now,
    lastActiveAt: now,
  };
}

/**
 * Returns a safe value after logout has invalidated an older in-flight
 * request. It deliberately does not write that value back to storage.
 */
function sessionAfterCancellation(now: string): SessionData {
  const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
  return makeLocalSession(now, stored);
}

function persistSession(session: SessionData, epoch: number): SessionData {
  if (epoch === sessionEpoch) {
    cachedSession = session;
    safeSetItem(STORAGE_KEYS.SESSION, session);
  }
  return session;
}

function restorePreviousSession(
  epoch: number,
  cached: SessionData | null,
  stored: SessionData | null,
): void {
  if (epoch !== sessionEpoch) return;
  const restored = cached ?? stored;
  if (restored) {
    cachedSession = restored;
    safeSetItem(STORAGE_KEYS.SESSION, restored);
  }
}

/**
 * Asynchronously retrieves or initializes an anonymous session.
 * Deduplicates in-flight calls to avoid redundant auth triggers during renders.
 */
export async function getOrCreateAnonymousSession(): Promise<SessionData> {
  if (cachedSession) return cachedSession;
  if (sessionPromise) return sessionPromise;

  const epoch = sessionEpoch;
  const promise = (async (): Promise<SessionData> => {
    const now = new Date().toISOString();
    const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);

    try {
      const client = createClient();
      if (client) {
        const { data: userData } = (await withTimeout(client.auth.getUser())) as {
          data: { user: { id: string; is_anonymous?: boolean } | null };
        };
        if (epoch !== sessionEpoch) return sessionAfterCancellation(now);

        if (userData?.user?.id) {
          return persistSession(
            {
              sessionId: userData.user.id,
              isAnonymous: userData.user.is_anonymous === true,
              isRemote: true,
              createdAt: stored?.createdAt ?? now,
              lastActiveAt: now,
            },
            epoch,
          );
        }

        if (epoch !== sessionEpoch) return sessionAfterCancellation(now);
        const { data: anonData, error: anonError } = (await withTimeout(
          client.auth.signInAnonymously(),
        )) as { data: { user: { id: string; is_anonymous?: boolean } | null } | null; error: unknown };
        if (epoch !== sessionEpoch) {
          if (!anonError && anonData?.user?.id) {
            await discardStaleAnonymousUser(client, anonData.user.id);
          }
          return sessionAfterCancellation(now);
        }

        if (!anonError && anonData?.user?.id) {
          return persistSession(
            {
              sessionId: anonData.user.id,
              isAnonymous: true,
              isRemote: true,
              createdAt: stored?.createdAt ?? now,
              lastActiveAt: now,
            },
            epoch,
          );
        }
      }
    } catch {
      // Supabase is offline, unreachable, or unconfigured. Fall through to the
      // resilient local anonymous session below.
    }

    if (epoch !== sessionEpoch) return sessionAfterCancellation(now);
    return persistSession(makeLocalSession(now, stored), epoch);
  })().finally(() => {
    if (sessionPromise === promise) sessionPromise = null;
  });

  sessionPromise = promise;
  return promise;
}

/**
 * Refreshes the app-level session from Supabase after sign-up/sign-in. The
 * epoch increment invalidates a prior anonymous lookup that may still be
 * resolving, which prevents progress writes from being sent to the old user.
 */
export async function syncAuthenticatedSession(): Promise<SessionData | null> {
  const client = createClient();
  if (!client) return null;

  const previousCachedSession = cachedSession;
  const previousStoredSession = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
  sessionEpoch += 1;
  sessionPromise = null;
  cachedSession = null;
  const epoch = sessionEpoch;

  try {
    const result = (await withTimeout(client.auth.getUser())) as {
      data: { user: { id: string; is_anonymous?: boolean } | null };
      error: unknown;
    };
    if (epoch !== sessionEpoch) return null;
    if (result.error) {
      restorePreviousSession(epoch, previousCachedSession, previousStoredSession);
      return null;
    }
    if (!result.data.user) {
      safeRemoveItem(STORAGE_KEYS.SESSION);
      return null;
    }

    const now = new Date().toISOString();
    const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
    return persistSession(
      {
        sessionId: result.data.user.id,
        isAnonymous: result.data.user.is_anonymous === true,
        isRemote: true,
        createdAt: stored?.createdAt ?? now,
        lastActiveAt: now,
      },
      epoch,
    );
  } catch {
    restorePreviousSession(epoch, previousCachedSession, previousStoredSession);
    return null;
  }
}

/**
 * Synchronous getter for the active session ID.
 * Returns cached session or stored session ID, or initializes a local one.
 */
export function getSessionId(): string {
  if (cachedSession) return cachedSession.sessionId;

  const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
  if (stored?.sessionId) {
    cachedSession = stored;
    return stored.sessionId;
  }

  const now = new Date().toISOString();
  const session = makeLocalSession(now);
  cachedSession = session;
  safeSetItem(STORAGE_KEYS.SESSION, session);
  return session.sessionId;
}

/** Operator callsign chosen on the login page. Displayed on the dossier. */
export function getCallsign(): string | null {
  const raw = safeGetItem<string | null>(STORAGE_KEYS.CALLSIGN, null, (value): value is string | null =>
    value === null || typeof value === "string",
  );
  return raw && raw.trim() ? raw.trim() : null;
}

export function saveCallsign(callsign: string): void {
  safeSetItem(STORAGE_KEYS.CALLSIGN, callsign.trim().slice(0, 24));
}

/** Returns the account that owns the current local user-scoped snapshot. */
export function getActiveAccountId(): string | null {
  return safeGetItem<string | null>(STORAGE_KEYS.ACCOUNT_ID, null, (value): value is string | null =>
    value === null || typeof value === "string",
  );
}

/** Marks which authenticated account owns local user-scoped state. */
export function setActiveAccountId(accountId: string | null): void {
  if (accountId) safeSetItem(STORAGE_KEYS.ACCOUNT_ID, accountId);
  else safeRemoveItem(STORAGE_KEYS.ACCOUNT_ID);
}

/** Clears data that must never cross an account boundary in one browser. */
export function clearUserScopedState(): void {
  safeRemoveItem(STORAGE_KEYS.PROGRESS);
  safeRemoveItem(STORAGE_KEYS.AVATAR);
  safeRemoveItem(STORAGE_KEYS.ACTIVE_FLOW);
  safeRemoveItem(STORAGE_KEYS.CHALLENGE_COURIER);
  safeRemoveItem(STORAGE_KEYS.CHALLENGE_SOCIAL);
}

/** Resets the active session and invalidates any in-flight session lookup. */
export function clearAnonymousSession(): void {
  sessionEpoch += 1;
  cachedSession = null;
  sessionPromise = null;
  safeRemoveItem(STORAGE_KEYS.SESSION);
}

/**
 * Clears authenticated/session-scoped state after logout. User-scoped local
 * snapshots are removed so a later account cannot inherit them; remote Alethia
 * progress remains available from Supabase.
 */
export function clearActiveSession(): void {
  clearAnonymousSession();
  clearUserScopedState();
  setActiveAccountId(null);
  safeRemoveItem(STORAGE_KEYS.CALLSIGN);
}

/**
 * React hook to access and synchronize the anonymous/authenticated session
 * across components and browser tabs.
 */
export function useAnonymousSession(): {
  session: SessionData | null;
  isLoading: boolean;
  sessionId: string;
} {
  const [session, setSession] = useState<SessionData | null>(() => {
    if (cachedSession) return cachedSession;
    return safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
  });
  const [isLoading, setIsLoading] = useState<boolean>(!session);

  useEffect(() => {
    let active = true;

    void getOrCreateAnonymousSession()
      .then((resolved) => {
        if (active) {
          setSession(resolved);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          const fallback = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
          setSession(fallback);
          setIsLoading(false);
        }
      });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.SESSION) {
        if (event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue) as unknown;
            if (isSessionData(parsed)) {
              cachedSession = parsed;
              setSession(parsed);
            }
          } catch {
            // Ignored.
          }
        } else {
          cachedSession = null;
          setSession(null);
        }
      }
    };

    if (typeof window !== "undefined") window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      if (typeof window !== "undefined") window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    session,
    isLoading,
    sessionId: session?.sessionId ?? (typeof window === "undefined" ? "server" : getSessionId()),
  };
}
