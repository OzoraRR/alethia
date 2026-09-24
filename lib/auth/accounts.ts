"use client";

/**
 * Supabase-backed operator accounts.
 *
 * Supabase Auth is the primary account store. The small local fallback is
 * retained only for the offline Sprint 1 experience when the public Supabase
 * environment variables are not configured.
 * No password is stored in a profile row; Supabase owns credential handling.
 */

import { createClient } from "@/lib/supabase/client";
import { clearAnonymousSession, syncAuthenticatedSession } from "@/lib/session/session";
import { safeGetItem, safeSetItem, STORAGE_KEYS } from "@/lib/storage/safe-storage";

export type Account = {
  id?: string;
  username: string;
  email: string;
  createdAt?: string;
};

type LocalAccount = Account & {
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
  | "email_confirmation_required"
  | "rate_limited"
  | "unavailable";

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createClient>>;
type RpcResult = { data: unknown; error: unknown };
type RpcClient = (functionName: string, args?: Record<string, unknown>) => Promise<RpcResult>;
type AuthErrorLike = { code?: string; message?: string; status?: number; name?: string };

export type AuthResult =
  | { account: Account }
  | { error: AuthError };

function getClient(): SupabaseBrowserClient | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function getRpc(client: SupabaseBrowserClient): RpcClient {
  return client.rpc.bind(client) as unknown as RpcClient;
}

function isLocalAccountList(value: unknown): value is LocalAccount[] {
  return (
    Array.isArray(value) &&
    value.every(
      (account) =>
        typeof account === "object" &&
        account !== null &&
        typeof (account as LocalAccount).username === "string" &&
        typeof (account as LocalAccount).email === "string" &&
        typeof (account as LocalAccount).salt === "string" &&
        typeof (account as LocalAccount).hash === "string",
    )
  );
}

function loadLocalAccounts(): LocalAccount[] {
  return safeGetItem<LocalAccount[]>(STORAGE_KEYS.ACCOUNTS, [], isLocalAccountList);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

function normalizeEmail(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function getErrorDetails(error: unknown): AuthErrorLike {
  if (typeof error !== "object" || error === null) return {};
  return error as AuthErrorLike;
}

function errorText(error: unknown): string {
  return getErrorDetails(error).message?.toLowerCase() ?? "";
}

function errorCode(error: unknown): string {
  return getErrorDetails(error).code?.toLowerCase() ?? "";
}

function mapSupabaseAuthError(error: unknown, operation: "register" | "login"): AuthError {
  const code = errorCode(error);
  const message = errorText(error);

  if (code === "429" || message.includes("rate limit") || message.includes("too many")) {
    return "rate_limited";
  }

  if (operation === "register") {
    if (code === "email_taken" || message.includes("email_taken")) {
      return "email_taken";
    }
    if (code === "username_taken" || message.includes("username_taken") || message.includes("username already")) {
      return "username_taken";
    }
    if (code === "23505") {
      return "username_taken";
    }
    if (
      code === "email_exists" ||
      code === "user_already_exists" ||
      message.includes("already registered") ||
      message.includes("already exists")
    ) {
      return "email_taken";
    }
    if (message.includes("password") && (message.includes("short") || message.includes("at least") || message.includes("length"))) {
      return "password_short";
    }
    if (message.includes("email") && (message.includes("invalid") || message.includes("format"))) {
      return "email_invalid";
    }
  } else if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "email_confirmation_required";
  } else if (
    code === "invalid_credentials" ||
    code === "invalid_login_credentials" ||
    message.includes("invalid login") ||
    message.includes("invalid credentials") ||
    message.includes("email or password")
  ) {
    return "invalid_credentials";
  }

  return "unavailable";
}

async function usernameExists(client: SupabaseBrowserClient, username: string): Promise<boolean> {
  try {
    const result = await getRpc(client)("profile_username_exists", { requested_username: username });
    return !result.error && result.data === true;
  } catch {
    // The signup request remains the source of truth if the optional lookup
    // helper has not been applied yet.
    return false;
  }
}

async function lookupEmailByUsername(client: SupabaseBrowserClient, username: string): Promise<string | null> {
  // Prefer the profiles table as the source of truth. RLS intentionally hides
  // other users' rows, so the narrow RPC below is the logged-out fallback.
  try {
    const result = await client
      .from("profiles")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (!result.error && typeof result.data?.email === "string" && result.data.email) {
      return result.data.email;
    }
  } catch {
    // Continue with the SECURITY DEFINER lookup function.
  }

  try {
    const result = await getRpc(client)("get_profile_email_by_username", { requested_username: username });
    return !result.error && typeof result.data === "string" && result.data ? result.data : null;
  } catch {
    return null;
  }
}

async function ensureProfile(
  client: SupabaseBrowserClient,
  userId: string,
  username: string,
  email: string,
): Promise<AuthError | null> {
  const { data: existing, error: lookupError } = await client
    .from("profiles")
    .select("id, username, email")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) return "unavailable";
  // The auth trigger owns identity fields. A pre-existing profile is left
  // untouched so a client cannot rewrite its email/username projection.
  if (existing) return null;

  const { error } = await client.from("profiles").insert({ id: userId, username, email });
  if (!error) return null;

  // The auth trigger normally creates the row in the same transaction. A
  // brief replication race can make the first SELECT miss it; re-read before
  // reporting a duplicate to the user.
  const { data: racedProfile } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (racedProfile) return null;
  return mapSupabaseAuthError(error, "register");
}

async function signOutAnonymousUserIfPresent(client: SupabaseBrowserClient): Promise<void> {
  try {
    const { data } = await client.auth.getUser();
    if (data.user?.is_anonymous) {
      try {
        await client.auth.signOut();
      } finally {
        clearAnonymousSession();
      }
    }
  } catch {
    // Sign-up can still proceed; Supabase will return the authoritative error.
  }
}

async function registerWithSupabase(
  client: SupabaseBrowserClient,
  input: { username: string; email: string; password: string },
): Promise<AuthResult> {
  if (await usernameExists(client, input.username)) return { error: "username_taken" };
  await signOutAnonymousUserIfPresent(client);

  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { username: input.username } },
  });

  if (error) return { error: mapSupabaseAuthError(error, "register") };
  if (!data.user) return { error: "unavailable" };
  if (!data.session) return { error: "email_confirmation_required" };

  // The auth user already exists once signUp returns successfully. Profile
  // hydration is idempotent and recoverable, so a transient profile/network
  // error must not make the UI encourage a duplicate signup.
  try {
    await ensureProfile(
      client,
      data.user.id,
      input.username,
      normalizeEmail(data.user.email ?? input.email),
    );
  } catch {
    // The trigger normally created the row; the account remains valid.
  }

  // Refresh the app-level session cache after Supabase has established the
  // authenticated session. This also cancels any anonymous-session request
  // that was in flight before registration.
  try {
    await syncAuthenticatedSession();
  } catch {
    // The Supabase client still owns the valid session; the dashboard can
    // revalidate it on its next request.
  }

  return {
    account: {
      id: data.user.id,
      username: input.username,
      email: normalizeEmail(data.user.email ?? input.email),
      createdAt: data.user.created_at,
    },
  };
}

async function loginWithSupabase(
  client: SupabaseBrowserClient,
  input: { identifier: string; password: string },
): Promise<AuthResult> {
  const identifier = normalizeIdentifier(input.identifier);
  if (!identifier || !input.password) return { error: "invalid_credentials" };

  const email = isEmail(identifier) ? identifier : await lookupEmailByUsername(client, identifier);
  if (!email) return { error: "invalid_credentials" };

  const { data, error } = await client.auth.signInWithPassword({ email, password: input.password });
  if (error || !data.user) return { error: mapSupabaseAuthError(error, "login") };

  const accountUsername =
    typeof data.user.user_metadata?.username === "string" && data.user.user_metadata.username.trim()
      ? data.user.user_metadata.username.trim()
      : (await lookupUsernameById(client, data.user.id)) ?? email.split("@")[0];

  try {
    await ensureProfile(
      client,
      data.user.id,
      accountUsername,
      normalizeEmail(data.user.email ?? email),
    );
  } catch {
    // A profile can be hydrated on the next authenticated visit.
  }
  try {
    await syncAuthenticatedSession();
  } catch {
    // The Supabase client still owns the valid session.
  }

  return {
    account: {
      id: data.user.id,
      username: accountUsername,
      email: normalizeEmail(data.user.email ?? email),
      createdAt: data.user.created_at,
    },
  };
}

async function lookupUsernameById(client: SupabaseBrowserClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    if (!error && typeof data?.username === "string" && data.username.trim()) return data.username.trim();
  } catch {
    // Fall back to the email-derived username in the caller.
  }
  return null;
}

async function registerLocal(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<AuthResult> {
  const accounts = loadLocalAccounts();
  if (accounts.some((account) => account.username.toLowerCase() === input.username.toLowerCase())) {
    return { error: "username_taken" };
  }
  if (accounts.some((account) => account.email.toLowerCase() === input.email.toLowerCase())) {
    return { error: "email_taken" };
  }

  try {
    const salt = randomSalt();
    const hash = await sha256Hex(`${salt}:${input.password}`);
    const account: LocalAccount = {
      username: input.username,
      email: input.email,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    safeSetItem(STORAGE_KEYS.ACCOUNTS, [...accounts, account].slice(-50));
    return { account: { username: account.username, email: account.email, createdAt: account.createdAt } };
  } catch {
    return { error: "unavailable" };
  }
}

async function loginLocal(input: { identifier: string; password: string }): Promise<AuthResult> {
  const id = normalizeIdentifier(input.identifier);
  const account = loadLocalAccounts().find(
    (candidate) => candidate.username.toLowerCase() === id || candidate.email.toLowerCase() === id,
  );
  if (!account) return { error: "invalid_credentials" };

  try {
    const hash = await sha256Hex(`${account.salt}:${input.password}`);
    if (hash !== account.hash) return { error: "invalid_credentials" };
    return {
      account: {
        username: account.username,
        email: account.email,
        createdAt: account.createdAt,
      },
    };
  } catch {
    return { error: "unavailable" };
  }
}

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function validateRegistration(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): { username: string; email: string } | { error: AuthError } {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  if (!USERNAME_RE.test(username)) return { error: "username_invalid" };
  if (!isEmail(email)) return { error: "email_invalid" };
  if (input.password.length < 8) return { error: "password_short" };
  if (input.password !== input.confirm) return { error: "password_mismatch" };
  return { username, email };
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<AuthResult> {
  const normalized = validateRegistration(input);
  if ("error" in normalized) return normalized;

  const client = getClient();
  if (!client) {
    return registerLocal({ ...input, ...normalized });
  }

  try {
    return await registerWithSupabase(client, {
      username: normalized.username,
      email: normalized.email,
      password: input.password,
    });
  } catch {
    return { error: "unavailable" };
  }
}

export async function login(input: { identifier: string; password: string }): Promise<AuthResult> {
  const client = getClient();
  if (!client) return loginLocal(input);

  try {
    return await loginWithSupabase(client, input);
  } catch {
    return { error: "unavailable" };
  }
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const client = getClient();
  if (!client) return { error: null };
  try {
    const { error } = await client.auth.signOut();
    return { error: error ? "unavailable" : null };
  } catch {
    return { error: "unavailable" };
  }
}
