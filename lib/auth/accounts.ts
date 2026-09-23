"use client";

/**
 * Browser-local operator accounts (username + email + salted SHA-256).
 * No backend user table exists in this project, so credentials never leave
 * this browser. Passwords are stored as salted hashes, never plaintext.
 */

import { safeGetItem, safeSetItem, STORAGE_KEYS } from "@/lib/storage/safe-storage";

export type Account = {
  username: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
};

export type AuthError =
  | "username_invalid"
  | "email_invalid"
  | "password_short"
  | "password_mismatch"
  | "username_taken"
  | "email_taken"
  | "invalid_credentials"
  | "unavailable";

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isAccountList(val: unknown): val is Account[] {
  return (
    Array.isArray(val) &&
    val.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as Account).username === "string" &&
        typeof (a as Account).hash === "string",
    )
  );
}

function loadAccounts(): Account[] {
  return safeGetItem(STORAGE_KEYS.ACCOUNTS, [], isAccountList);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<{ account: Account } | { error: AuthError }> {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  if (!USERNAME_RE.test(username)) return { error: "username_invalid" };
  if (!EMAIL_RE.test(email)) return { error: "email_invalid" };
  if (input.password.length < 8) return { error: "password_short" };
  if (input.password !== input.confirm) return { error: "password_mismatch" };

  const accounts = loadAccounts();
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    return { error: "username_taken" };
  }
  if (accounts.some((a) => a.email.toLowerCase() === email)) {
    return { error: "email_taken" };
  }

  try {
    const salt = randomSalt();
    const hash = await sha256Hex(`${salt}:${input.password}`);
    const account: Account = { username, email, salt, hash, createdAt: new Date().toISOString() };
    safeSetItem(STORAGE_KEYS.ACCOUNTS, [...accounts, account].slice(-50));
    return { account };
  } catch {
    return { error: "unavailable" };
  }
}

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<{ account: Account } | { error: AuthError }> {
  const id = normalizeIdentifier(input.identifier);
  const account = loadAccounts().find(
    (a) => a.username.toLowerCase() === id || a.email.toLowerCase() === id,
  );
  if (!account) return { error: "invalid_credentials" };
  try {
    const hash = await sha256Hex(`${account.salt}:${input.password}`);
    if (hash !== account.hash) return { error: "invalid_credentials" };
    return { account };
  } catch {
    return { error: "unavailable" };
  }
}
