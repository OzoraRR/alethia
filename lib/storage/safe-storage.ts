/**
 * Safe LocalStorage access layer with in-memory fallback and corrupted JSON resilience.
 */

export const STORAGE_KEYS = {
  SESSION: "alethia:session:v1",
  PROGRESS: "alethia:practice-progress:v1",
  CHALLENGE_COURIER: "alethia:challenge:courier-sms:v1",
  CHALLENGE_SOCIAL: "alethia:challenge:social-engineering:v1",
  ACTIVE_FLOW: "alethia:active-flow:v1",
  AVATAR: "alethia:avatar:v1",
  REPORTS: "alethia:practice-reports:v1",
  CALLSIGN: "alethia:operator-callsign:v1",
  ACCOUNTS: "alethia:operator-accounts:v1",
  ACCOUNT_ID: "alethia:active-account:v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS] | (string & {});

const memoryStore = new Map<string, string>();

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__alethia_storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return getStorage() !== null;
}

export function safeGetItem<T>(
  key: StorageKey,
  fallback: T,
  validator?: (value: unknown) => value is T,
): T {
  try {
    const storage = getStorage();
    const raw = storage ? storage.getItem(key) : memoryStore.get(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as unknown;
    if (validator && !validator(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function safeSetItem<T>(key: StorageKey, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    const storage = getStorage();
    if (storage) {
      storage.setItem(key, serialized);
    }
    memoryStore.set(key, serialized);
    return true;
  } catch {
    try {
      memoryStore.set(key, JSON.stringify(value));
    } catch {
      // Ignored
    }
    return false;
  }
}

export function safeRemoveItem(key: StorageKey): boolean {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(key);
    }
    memoryStore.delete(key);
    return true;
  } catch {
    memoryStore.delete(key);
    return false;
  }
}

export function safeClearNamespace(prefix = "alethia:"): void {
  try {
    const storage = getStorage();
    if (storage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    }
    for (const key of Array.from(memoryStore.keys())) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
      }
    }
  } catch {
    // Ignored
  }
}
