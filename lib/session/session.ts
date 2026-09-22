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

/**
 * Asynchronously retrieves or initializes an anonymous session.
 * Deduplicates in-flight calls to avoid redundant auth triggers during renders.
 */
export async function getOrCreateAnonymousSession(): Promise<SessionData> {
  if (cachedSession) {
    return cachedSession;
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async (): Promise<SessionData> => {
    const now = new Date().toISOString();
    const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);

    // Try Supabase first if available
    try {
      const client = createClient();
      if (client) {
        // Check for existing Supabase auth user
        const { data: userData } = (await withTimeout(client.auth.getUser())) as {
          data: { user: { id: string; is_anonymous?: boolean } | null };
        };
        if (userData?.user?.id) {
          const session: SessionData = {
            sessionId: userData.user.id,
            isAnonymous: userData.user.is_anonymous ?? true,
            isRemote: true,
            createdAt: stored?.createdAt ?? now,
            lastActiveAt: now,
          };
          cachedSession = session;
          safeSetItem(STORAGE_KEYS.SESSION, session);
          return session;
        }

        // Attempt anonymous sign in
        const { data: anonData, error: anonError } = (await withTimeout(
          client.auth.signInAnonymously(),
        )) as { data: { user: { id: string } | null } | null; error: unknown };
        if (!anonError && anonData?.user?.id) {
          const session: SessionData = {
            sessionId: anonData.user.id,
            isAnonymous: true,
            isRemote: true,
            createdAt: stored?.createdAt ?? now,
            lastActiveAt: now,
          };
          cachedSession = session;
          safeSetItem(STORAGE_KEYS.SESSION, session);
          return session;
        }
      }
    } catch {
      // Supabase is offline, unreachable, or unconfigured - fallback to LocalStorage
    }

    // Fallback: LocalStorage session
    if (stored) {
      const refreshed: SessionData = {
        ...stored,
        lastActiveAt: now,
      };
      cachedSession = refreshed;
      safeSetItem(STORAGE_KEYS.SESSION, refreshed);
      return refreshed;
    }

    const newSession: SessionData = {
      sessionId: generateLocalAnonymousId(),
      isAnonymous: true,
      isRemote: false,
      createdAt: now,
      lastActiveAt: now,
    };
    cachedSession = newSession;
    safeSetItem(STORAGE_KEYS.SESSION, newSession);
    return newSession;
  })().finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

/**
 * Synchronous getter for the active session ID.
 * Returns cached session or stored session ID, or initializes a local one.
 */
export function getSessionId(): string {
  if (cachedSession) {
    return cachedSession.sessionId;
  }
  const stored = safeGetItem<SessionData | null>(STORAGE_KEYS.SESSION, null, isSessionData);
  if (stored?.sessionId) {
    cachedSession = stored;
    return stored.sessionId;
  }
  const localId = generateLocalAnonymousId();
  const now = new Date().toISOString();
  const session: SessionData = {
    sessionId: localId,
    isAnonymous: true,
    isRemote: false,
    createdAt: now,
    lastActiveAt: now,
  };
  cachedSession = session;
  safeSetItem(STORAGE_KEYS.SESSION, session);
  return localId;
}

/**
 * Resets the active session and clears stored session key.
 */
export function clearAnonymousSession(): void {
  cachedSession = null;
  sessionPromise = null;
  safeRemoveItem(STORAGE_KEYS.SESSION);
}

/**
 * React hook to access and synchronize the anonymous session across components and browser tabs.
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
          const fallback = safeGetItem<SessionData | null>(
            STORAGE_KEYS.SESSION,
            null,
            isSessionData,
          );
          setSession(fallback);
          setIsLoading(false);
        }
      });

    // Cross-tab synchronization
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
            // Ignored
          }
        } else {
          cachedSession = null;
          setSession(null);
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, []);

  return {
    session,
    isLoading,
    sessionId: session?.sessionId ?? (typeof window === "undefined" ? "server" : getSessionId()),
  };
}
