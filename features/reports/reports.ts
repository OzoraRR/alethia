import { createClient } from "@/lib/supabase/client";
import type { PracticeProgress } from "../progress/progress";

export type ReportSort = "newest" | "oldest" | "top";
export type ReportScope = "all" | "mine";
export type Role = "investigator" | "student";
export type ReviewStatus = "queued" | "approved" | "rejected";

export type LaporanReport = {
  id: string;
  userId: string;
  moduleId: string | null;
  attemptId: string | null;
  title: string;
  category: string;
  channel: string;
  pattern: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  review: ReviewStatus;
  evidence: string;
  whyRisky: string;
  url?: string;
  screenshot?: string;
  signalScore: number;
  hasSignaled: boolean;
  isOwner: boolean;
};

export type InvestigationNote = {
  id: string;
  reportId: string;
  authorRole: Role;
  text: string;
  createdAt: string;
};

export type ReportInput = {
  title: string;
  category: string;
  channel: string;
  pattern: string;
  evidence: string;
  whyRisky: string;
  url?: string;
  screenshot?: string;
  moduleId?: string;
  attemptId?: string;
};

export type UpdateReportInput = Omit<
  ReportInput,
  "moduleId" | "attemptId"
> & {
  removeScreenshot?: boolean;
};

export const REPORT_CATEGORIES = ["SMS phishing", "Marketplace scam", "Account impersonation"] as const;
export const REPORT_CHANNELS = ["Text message", "Marketplace chat", "Direct message"] as const;
export const REPORT_PATTERNS = ["Urgency", "Trust transfer", "Channel shift", "Unusual payment request"] as const;
export const MAX_SCREENSHOT_BYTES = 500 * 1024;

const REPORT_SELECT =
  "id, user_id, module_id, attempt_id, title, category, channel, pattern, author_username, created_at, updated_at, status, review_status, evidence, why_risky, defanged_url, screenshot_data_url, signal_score";

type ReportRow = {
  id?: unknown;
  user_id?: unknown;
  module_id?: unknown;
  attempt_id?: unknown;
  title?: unknown;
  category?: unknown;
  channel?: unknown;
  pattern?: unknown;
  author_username?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  status?: unknown;
  review_status?: unknown;
  evidence?: unknown;
  why_risky?: unknown;
  defanged_url?: unknown;
  screenshot_data_url?: unknown;
  signal_score?: unknown;
};

type NoteRow = {
  id?: unknown;
  report_id?: unknown;
  author_role?: unknown;
  text?: unknown;
  created_at?: unknown;
};

type AuthContext = {
  client: NonNullable<ReturnType<typeof createClient>>;
  userId: string;
};

export class ReportPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportPersistenceError";
  }
}

/** Investigator unlock: 1 completed module + a safe result on the latest attempt. */
export function getRole(progress: PracticeProgress): Role {
  return progress.modulesCompleted >= 1 && progress.lastRetryResult === "safe"
    ? "investigator"
    : "student";
}

export async function loadReports(
  sort: ReportSort,
  scope: ReportScope = "all",
): Promise<LaporanReport[]> {
  const auth = await requireAuthContext();
  let request = auth.client
    .from("practice_reports")
    .select(REPORT_SELECT)
    .limit(200);

  if (scope === "mine") {
    request = request.eq("user_id", auth.userId);
  }

  if (sort === "newest") {
    request = request.order("created_at", { ascending: false }).order("id", { ascending: false });
  } else if (sort === "oldest") {
    request = request.order("created_at", { ascending: true }).order("id", { ascending: true });
  } else {
    request = request.order("signal_score", { ascending: false }).order("created_at", { ascending: false });
  }

  const [reportResult, signalResult] = await Promise.all([
    request,
    auth.client.from("report_signals").select("report_id").eq("user_id", auth.userId),
  ]);

  if (reportResult.error) {
    throw new ReportPersistenceError("Laporan tidak dapat dimuat dari database.");
  }
  if (signalResult.error) {
    console.warn("[Alethia] report signal state was not synchronized.");
  }

  const signaledIds = new Set(
    ((signalResult.data ?? []) as Array<{ report_id?: unknown }>)
      .map((row) => row.report_id)
      .filter((value): value is string => typeof value === "string"),
  );

  return ((reportResult.data ?? []) as ReportRow[])
    .map((row) =>
      normalizeReport(
        row,
        signaledIds.has(asString(row.id) ?? ""),
        asString(row.user_id) === auth.userId,
      ),
    )
    .filter((report): report is LaporanReport => report !== null);
}

export async function saveUserReport(input: ReportInput): Promise<LaporanReport> {
  const auth = await requireAuthContext();
  const payload = {
    user_id: auth.userId,
    module_id: input.moduleId ?? null,
    attempt_id: input.attemptId ?? null,
    source: "manual",
    ...validatedReportContent(input),
    screenshot_data_url: input.screenshot ?? null,
  };

  const { data, error } = await auth.client
    .from("practice_reports")
    .insert(payload)
    .select(REPORT_SELECT)
    .single();

  if (error || !data) {
    console.warn("[Alethia] practice report insert failed.", reportErrorCode(error));
    throw new ReportPersistenceError("Laporan gagal disimpan. Silakan coba lagi.");
  }

  const report = normalizeReport(data as ReportRow, false, true);
  if (!report) throw new ReportPersistenceError("Respons database laporan tidak valid.");
  return report;
}

export async function updateUserReport(
  reportId: string,
  input: UpdateReportInput,
): Promise<LaporanReport> {
  const auth = await requireAuthContext();
  const { data, error } = await auth.client
    .from("practice_reports")
    .update({
      ...validatedReportContent(input),
      screenshot_data_url: input.removeScreenshot ? null : input.screenshot ?? null,
    })
    .eq("id", reportId)
    .eq("user_id", auth.userId)
    .select(REPORT_SELECT)
    .single();

  if (error || !data) {
    console.warn("[Alethia] practice report update failed.", reportErrorCode(error));
    throw new ReportPersistenceError("Laporan tidak dapat diperbarui.");
  }

  const report = normalizeReport(data as ReportRow, false, true);
  if (!report) throw new ReportPersistenceError("Respons database laporan tidak valid.");
  return report;
}

export async function deleteUserReport(reportId: string): Promise<void> {
  const auth = await requireAuthContext();
  const { data, error } = await auth.client
    .from("practice_reports")
    .delete()
    .eq("id", reportId)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[Alethia] practice report delete failed.", reportErrorCode(error));
    throw new ReportPersistenceError("Laporan tidak dapat dihapus.");
  }
  if (!data) throw new ReportPersistenceError("Laporan tidak ditemukan atau bukan milik Anda.");
}

export async function toggleReportSignal(
  reportId: string,
): Promise<{ active: boolean; signalScore: number }> {
  const auth = await requireAuthContext();
  const existing = await auth.client
    .from("report_signals")
    .select("report_id")
    .eq("report_id", reportId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (existing.error) throw new ReportPersistenceError("Status signal tidak dapat dibaca.");

  if (existing.data) {
    const removal = await auth.client
      .from("report_signals")
      .delete()
      .eq("report_id", reportId)
      .eq("user_id", auth.userId);
    if (removal.error) throw new ReportPersistenceError("Signal tidak dapat dibatalkan.");
  } else {
    const addition = await auth.client
      .from("report_signals")
      .insert({ report_id: reportId, user_id: auth.userId });
    if (addition.error) throw new ReportPersistenceError("Signal tidak dapat disimpan.");
  }

  const scoreResult = await auth.client
    .from("practice_reports")
    .select("signal_score")
    .eq("id", reportId)
    .single();
  if (scoreResult.error) throw new ReportPersistenceError("Jumlah signal tidak dapat dimuat.");

  return {
    active: !existing.data,
    signalScore: nonNegativeInteger(scoreResult.data?.signal_score),
  };
}

export async function loadNotes(reportId: string): Promise<InvestigationNote[]> {
  const auth = await requireAuthContext();
  const { data, error } = await auth.client
    .from("report_investigation_notes")
    .select("id, report_id, author_role, text, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw new ReportPersistenceError("Catatan investigasi tidak dapat dimuat.");
  return ((data ?? []) as NoteRow[])
    .map(normalizeNote)
    .filter((note): note is InvestigationNote => note !== null);
}

export async function addNote(
  reportId: string,
  role: Role,
  text: string,
): Promise<InvestigationNote> {
  const auth = await requireAuthContext();
  const normalizedText = text.trim();
  if (normalizedText.length < 4) throw new ReportPersistenceError("Catatan minimal 4 karakter.");

  const { data, error } = await auth.client
    .from("report_investigation_notes")
    .insert({ report_id: reportId, user_id: auth.userId, author_role: role, text: normalizedText })
    .select("id, report_id, author_role, text, created_at")
    .single();

  if (error || !data) {
    console.warn("[Alethia] investigation note insert failed.", reportErrorCode(error));
    throw new ReportPersistenceError("Catatan gagal disimpan.");
  }
  const note = normalizeNote(data as NoteRow);
  if (!note) throw new ReportPersistenceError("Respons database catatan tidak valid.");
  return note;
}

/** Layout decides by sort: only top signals gets the featured-cards layout. */
export function isCompactSort(sort: ReportSort): boolean {
  return sort !== "top";
}

export function sortReports(reports: LaporanReport[], sort: ReportSort): LaporanReport[] {
  const copy = [...reports];
  if (sort === "oldest") {
    copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  } else if (sort === "top") {
    copy.sort(
      (a, b) =>
        b.signalScore - a.signalScore ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  } else {
    copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  return copy;
}

export function defang(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replaceAll(".", "[.]");
}

export function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function validatedReportContent(input: ReportInput) {
  const title = input.title.trim();
  const evidence = input.evidence.trim();
  const whyRisky = input.whyRisky.trim();

  if (title.length < 4 || title.length > 160) {
    throw new ReportPersistenceError("Judul laporan harus terdiri dari 4–160 karakter.");
  }
  if (evidence.length < 10 || evidence.length > 5000) {
    throw new ReportPersistenceError("Bukti harus terdiri dari 10–5000 karakter.");
  }
  if (whyRisky.length < 10 || whyRisky.length > 5000) {
    throw new ReportPersistenceError("Alasan risiko harus terdiri dari 10–5000 karakter.");
  }

  return {
    title,
    category: input.category,
    channel: input.channel,
    pattern: input.pattern,
    evidence,
    why_risky: whyRisky,
    defanged_url: input.url?.trim() ? defang(input.url) : null,
  };
}

async function requireAuthContext(): Promise<AuthContext> {
  const client = getClient();
  if (!client) throw new ReportPersistenceError("Koneksi database laporan belum dikonfigurasi.");

  const result = await client.auth.getUser();
  if (result.error || !result.data.user) {
    throw new ReportPersistenceError("Masuk terlebih dahulu untuk menggunakan database laporan.");
  }
  return { client, userId: result.data.user.id };
}

function getClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function normalizeReport(
  value: ReportRow,
  hasSignaled: boolean,
  isOwner: boolean,
): LaporanReport | null {
  const id = asString(value.id);
  const userId = asString(value.user_id);
  const title = asString(value.title);
  const category = asString(value.category);
  const channel = asString(value.channel);
  const pattern = asString(value.pattern);
  const author = asString(value.author_username);
  const createdAt = asTimestamp(value.created_at);
  const updatedAt = asTimestamp(value.updated_at);
  const status = asString(value.status);
  if (!id || !userId || !title || !category || !channel || !pattern || !author || !createdAt || !updatedAt || !status) {
    return null;
  }

  return {
    id,
    userId,
    moduleId: asString(value.module_id),
    attemptId: asString(value.attempt_id),
    title,
    category,
    channel,
    pattern,
    author,
    createdAt,
    updatedAt,
    status,
    review: isReviewStatus(value.review_status) ? value.review_status : "queued",
    evidence: asString(value.evidence) ?? "",
    whyRisky: asString(value.why_risky) ?? "",
    url: asString(value.defanged_url) ?? undefined,
    screenshot: asString(value.screenshot_data_url) ?? undefined,
    signalScore: nonNegativeInteger(value.signal_score),
    hasSignaled,
    isOwner,
  };
}

function normalizeNote(value: NoteRow): InvestigationNote | null {
  const id = asString(value.id);
  const reportId = asString(value.report_id);
  const text = asString(value.text);
  const createdAt = asTimestamp(value.created_at);
  if (!id || !reportId || !text || !createdAt) return null;
  if (value.author_role !== "student" && value.author_role !== "investigator") return null;
  return { id, reportId, authorRole: value.author_role, text, createdAt };
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === "queued" || value === "approved" || value === "rejected";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function reportErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unknown";
}
