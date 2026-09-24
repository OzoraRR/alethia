import { safeGetItem, safeSetItem, STORAGE_KEYS } from "@/lib/storage/safe-storage";
import type { PracticeProgress } from "../progress/progress";

export type ReportRange = "monthly" | "all";
export type ReportSort = "newest" | "oldest" | "title" | "top" | "review";
export type Role = "investigator" | "student";
export type ReviewStatus = "queued" | "approved";

export type LaporanReport = {
  id: string;
  title: string;
  category: string;
  channel: string;
  pattern: string;
  author: string;
  createdAt: string;
  status: string;
  review: ReviewStatus;
  evidence: string;
  whyRisky: string;
  url?: string;
  screenshot?: string;
};

export type InvestigationNote = {
  id: string;
  authorRole: Role;
  text: string;
  createdAt: string;
};

export const REPORT_CATEGORIES = ["SMS phishing", "Marketplace scam", "Account impersonation"] as const;
export const REPORT_CHANNELS = ["Text message", "Marketplace chat", "Direct message"] as const;
export const REPORT_PATTERNS = ["Urgency", "Trust transfer", "Channel shift", "Unusual payment request"] as const;

export const MAX_SCREENSHOT_BYTES = 500 * 1024;

const DAY_MS = 86_400_000;
const SIGNAL_KEY = "alethia:report-signals:v1";
const NOTES_KEY = "alethia:report-notes:v1";

function daysAgoISO(now: number, days: number): string {
  return new Date(now - days * DAY_MS).toISOString();
}

/** Investigator unlock: 1 completed module + a safe result on the latest attempt. */
export function getRole(progress: PracticeProgress): Role {
  return progress.modulesCompleted >= 1 && progress.lastRetryResult === "safe"
    ? "investigator"
    : "student";
}

export function seedReports(now = Date.now()): LaporanReport[] {
  return [
    {
      id: "seed-courier-surge",
      title: "Courier SMS surge with fake redelivery fee",
      category: "SMS phishing",
      channel: "Text message",
      pattern: "Urgency + fake delivery",
      author: "sinyal_ops",
      createdAt: daysAgoISO(now, 2),
      status: "Triaged",
      review: "approved",
      evidence: "Three identical texts from +62 811-xxxx within one hour, all linking outside the courier app.",
      whyRisky: "Urgency plus an off-channel fee route pushes the target to act before verifying.",
      url: "parcel-track[.]example",
    },
    {
      id: "seed-marketplace-fee",
      title: "Marketplace deal moved off-platform, verification fee",
      category: "Marketplace scam",
      channel: "Marketplace chat",
      pattern: "Trust transfer + fee",
      author: "rute_aman",
      createdAt: daysAgoISO(now, 6),
      status: "Learning note",
      review: "approved",
      evidence: "Seller with 4.9 rating asked to continue on an outside chat, then a Rp75.000 fee appeared.",
      whyRisky: "Trust borrowed from reviews is used to exit platform protection before the fee request.",
      url: "safe-pay[.]example",
    },
    {
      id: "seed-impersonation-dm",
      title: "Support account DM asking to switch channels",
      category: "Account impersonation",
      channel: "Direct message",
      pattern: "Authority + channel shift",
      author: "kadaluwarsa",
      createdAt: daysAgoISO(now, 11),
      status: "Queued",
      review: "queued",
      evidence: "DM from an account copying the marketplace helpdesk name, no verified badge.",
      whyRisky: "Authority impersonation plus a channel shift removes the conversation from platform evidence.",
      url: "support-check[.]example",
    },
    {
      id: "seed-parcel-deadline",
      title: "Parcel deadline text with lookalike tracking link",
      category: "SMS phishing",
      channel: "Text message",
      pattern: "Urgency",
      author: "jeda_dulu",
      createdAt: daysAgoISO(now, 19),
      status: "Triaged",
      review: "approved",
      evidence: "Link domain differs from the official courier domain by one letter.",
      whyRisky: "A same-day deadline discourages the independent check that would expose the domain.",
      url: "lacak-paket[.]example",
    },
    {
      id: "seed-refund-deposit",
      title: "Refund pretext requesting a security deposit",
      category: "Marketplace scam",
      channel: "Marketplace chat",
      pattern: "Unusual payment request",
      author: "verifikasi_mandiri",
      createdAt: daysAgoISO(now, 34),
      status: "Learning note",
      review: "approved",
      evidence: "Refund flow invented a deposit step not present on the marketplace help page.",
      whyRisky: "Reverses the refund direction: the buyer is asked to pay before receiving anything.",
      url: "refund-bantu[.]example",
    },
    {
      id: "seed-otp-forward",
      title: "Courier follow-up asking to forward an OTP code",
      category: "Account impersonation",
      channel: "Text message",
      pattern: "Authority + urgency",
      author: "lapor_hapus",
      createdAt: daysAgoISO(now, 52),
      status: "Queued",
      review: "queued",
      evidence: "Second message arrived minutes after the first, requesting the code just sent by the real service.",
      whyRisky: "OTP forwarding hands account access over; urgency blocks a callback to the real courier.",
      url: "kode-otp[.]example",
    },
  ];
}

function isLaporanReport(val: unknown): val is LaporanReport {
  if (typeof val !== "object" || val === null) return false;
  const r = val as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    typeof r.category === "string" &&
    typeof r.channel === "string" &&
    typeof r.pattern === "string" &&
    typeof r.author === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.status === "string"
  );
}

function isReportList(val: unknown): val is LaporanReport[] {
  return Array.isArray(val) && val.every(isLaporanReport);
}

function normalizeReport(r: LaporanReport): LaporanReport {
  return {
    ...r,
    review: r.review === "approved" ? "approved" : "queued",
    evidence: typeof r.evidence === "string" ? r.evidence : "",
    whyRisky: typeof r.whyRisky === "string" ? r.whyRisky : "",
  };
}

export function loadUserReports(): LaporanReport[] {
  return safeGetItem(STORAGE_KEYS.REPORTS, [], isReportList)
    .filter((r) => r.id.startsWith("user-"))
    .map(normalizeReport);
}

export function saveUserReport(input: {
  title: string;
  category: string;
  channel: string;
  pattern: string;
  evidence: string;
  whyRisky: string;
  url?: string;
  screenshot?: string;
}): LaporanReport {
  const report: LaporanReport = {
    id: `user-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: input.title.trim(),
    category: input.category,
    channel: input.channel,
    pattern: input.pattern,
    author: "you",
    createdAt: new Date().toISOString(),
    status: "Queued for developer review",
    review: "queued",
    evidence: input.evidence.trim(),
    whyRisky: input.whyRisky.trim(),
    url: input.url ? defang(input.url) : undefined,
    screenshot: input.screenshot,
  };
  const existing = safeGetItem(STORAGE_KEYS.REPORTS, [], isReportList);
  safeSetItem(STORAGE_KEYS.REPORTS, [report, ...existing].slice(0, 50));
  return report;
}

export function loadAllReports(now = Date.now()): LaporanReport[] {
  const seen = new Set<string>();
  return [...loadUserReports(), ...seedReports(now)].filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true),
  );
}

/* Signals: investigator-only endorsements, one per report per browser. */

function isIdList(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v) => typeof v === "string");
}

export function loadSignals(): string[] {
  return safeGetItem<string[]>(SIGNAL_KEY, [], isIdList);
}

export function hasSignaled(reportId: string): boolean {
  return loadSignals().includes(reportId);
}

export function toggleSignal(reportId: string): string[] {
  const current = loadSignals();
  const next = current.includes(reportId)
    ? current.filter((id) => id !== reportId)
    : [...current, reportId];
  safeSetItem(SIGNAL_KEY, next);
  return next;
}

function seedSignalCounts(): Record<string, number> {
  return {
    "seed-courier-surge": 18,
    "seed-marketplace-fee": 12,
    "seed-impersonation-dm": 4,
    "seed-parcel-deadline": 9,
    "seed-refund-deposit": 7,
    "seed-otp-forward": 2,
  };
}

export function signalCount(reportId: string): number {
  const base = seedSignalCounts()[reportId] ?? 0;
  return base + (hasSignaled(reportId) ? 1 : 0);
}

/* Investigation notes, stored locally per report. */

function isNoteList(val: unknown): val is InvestigationNote[] {
  return (
    Array.isArray(val) &&
    val.every(
      (n) =>
        typeof n === "object" &&
        n !== null &&
        typeof (n as InvestigationNote).text === "string",
    )
  );
}

function isNoteMap(val: unknown): val is Record<string, InvestigationNote[]> {
  if (typeof val !== "object" || val === null) return false;
  return Object.values(val as Record<string, unknown>).every(isNoteList);
}

export function loadNotes(reportId: string): InvestigationNote[] {
  const all = safeGetItem<Record<string, InvestigationNote[]>>(NOTES_KEY, {}, isNoteMap);
  return all[reportId] ?? [];
}

export function addNote(reportId: string, role: Role, text: string): InvestigationNote[] {
  const note: InvestigationNote = {
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    authorRole: role,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const all = safeGetItem<Record<string, InvestigationNote[]>>(NOTES_KEY, {}, isNoteMap);
  const next = { ...all, [reportId]: [...(all[reportId] ?? []), note].slice(-30) };
  safeSetItem(NOTES_KEY, next);
  return next[reportId];
}

export function filterReports(
  reports: LaporanReport[],
  range: ReportRange,
  now = Date.now(),
): LaporanReport[] {
  if (range === "all") return reports;
  const cutoff = now - 30 * DAY_MS;
  return reports.filter((r) => {
    const t = Date.parse(r.createdAt);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

/**
 * Layout decides by sort: only top signals gets the featured-cards layout,
 * every other sort renders the compact short-list.
 */
export function isCompactSort(sort: ReportSort): boolean {
  return sort !== "top";
}

export function sortReports(reports: LaporanReport[], sort: ReportSort): LaporanReport[] {
  const copy = [...reports];
  if (sort === "oldest") {
    copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  } else if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "top") {
    copy.sort(
      (a, b) =>
        signalCount(b.id) - signalCount(a.id) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  } else if (sort === "review") {
    const rank = (r: LaporanReport) => (r.review === "queued" ? 0 : 1);
    copy.sort(
      (a, b) => rank(a) - rank(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
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
