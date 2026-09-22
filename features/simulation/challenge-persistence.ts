"use client";

import type { ModuleId } from "../progress/progress";
import type { Decision, InspectionSignal, SimulationStage } from "./types";
import type {
  SocialEngineeringDecision,
  SocialEngineeringSignal,
  SocialEngineeringStage,
} from "../social-engineering/types";
import { safeGetItem, safeRemoveItem, safeSetItem, STORAGE_KEYS } from "../../lib/storage/safe-storage";

export type StoredCourierChallenge = {
  sessionId: string;
  stage: SimulationStage;
  inspectedSignals: InspectionSignal[];
  retryInspectedSignals: InspectionSignal[];
  verificationOpen: boolean;
  verificationChecked: boolean;
  decision: Decision | null;
  retryDecision: Decision | null;
  attemptId: string | null;
  lastUpdated: string;
  isCompleted: boolean;
};

export type StoredSocialChallenge = {
  sessionId: string;
  stage: SocialEngineeringStage;
  primarySignals: SocialEngineeringSignal[];
  retrySignals: SocialEngineeringSignal[];
  decision: SocialEngineeringDecision | null;
  retryDecision: SocialEngineeringDecision | null;
  attemptId: string | null;
  lastUpdated: string;
  isCompleted: boolean;
};

export type ActiveFlow = {
  activeModule: ModuleId | null;
  stage: string;
  lastActiveAt: string;
};

const validCourierStages = new Set<SimulationStage>([
  "briefing",
  "receive",
  "inspect",
  "verify",
  "decide",
  "reveal",
  "retry",
  "complete",
]);

const validSocialStages = new Set<SocialEngineeringStage>([
  "briefing",
  "context",
  "trust",
  "channel_shift",
  "pressure",
  "decide",
  "reveal",
  "retry",
  "complete",
]);

export function loadCourierChallenge(sessionId?: string): StoredCourierChallenge | null {
  const data = safeGetItem<StoredCourierChallenge | null>(
    STORAGE_KEYS.CHALLENGE_COURIER,
    null,
    isStoredCourierChallenge,
  );
  if (!data) return null;
  if (sessionId && data.sessionId && data.sessionId !== sessionId) {
    return null;
  }
  return data;
}

export function saveCourierChallenge(challenge: StoredCourierChallenge): void {
  safeSetItem(STORAGE_KEYS.CHALLENGE_COURIER, challenge);
  saveActiveFlow("courier-sms", challenge.stage);
}

export function clearCourierChallenge(): void {
  safeRemoveItem(STORAGE_KEYS.CHALLENGE_COURIER);
  const activeFlow = loadActiveFlow();
  if (activeFlow?.activeModule === "courier-sms") {
    clearActiveFlow();
  }
}

export function loadSocialChallenge(sessionId?: string): StoredSocialChallenge | null {
  const data = safeGetItem<StoredSocialChallenge | null>(
    STORAGE_KEYS.CHALLENGE_SOCIAL,
    null,
    isStoredSocialChallenge,
  );
  if (!data) return null;
  if (sessionId && data.sessionId && data.sessionId !== sessionId) {
    return null;
  }
  return data;
}

export function saveSocialChallenge(challenge: StoredSocialChallenge): void {
  safeSetItem(STORAGE_KEYS.CHALLENGE_SOCIAL, challenge);
  saveActiveFlow("social-engineering", challenge.stage);
}

export function clearSocialChallenge(): void {
  safeRemoveItem(STORAGE_KEYS.CHALLENGE_SOCIAL);
  const activeFlow = loadActiveFlow();
  if (activeFlow?.activeModule === "social-engineering") {
    clearActiveFlow();
  }
}

export function saveActiveFlow(activeModule: ModuleId | null, stage: string): void {
  safeSetItem(STORAGE_KEYS.ACTIVE_FLOW, {
    activeModule,
    stage,
    lastActiveAt: new Date().toISOString(),
  });
}

export function loadActiveFlow(): ActiveFlow | null {
  return safeGetItem<ActiveFlow | null>(STORAGE_KEYS.ACTIVE_FLOW, null, isActiveFlow);
}

export function clearActiveFlow(): void {
  safeRemoveItem(STORAGE_KEYS.ACTIVE_FLOW);
}

function isStoredCourierChallenge(value: unknown): value is StoredCourierChallenge {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.stage === "string" &&
    validCourierStages.has(candidate.stage as SimulationStage) &&
    Array.isArray(candidate.inspectedSignals) &&
    Array.isArray(candidate.retryInspectedSignals) &&
    typeof candidate.verificationOpen === "boolean" &&
    typeof candidate.verificationChecked === "boolean"
  );
}

function isStoredSocialChallenge(value: unknown): value is StoredSocialChallenge {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.stage === "string" &&
    validSocialStages.has(candidate.stage as SocialEngineeringStage) &&
    Array.isArray(candidate.primarySignals) &&
    Array.isArray(candidate.retrySignals)
  );
}

function isActiveFlow(value: unknown): value is ActiveFlow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.activeModule === null ||
      candidate.activeModule === "courier-sms" ||
      candidate.activeModule === "social-engineering") &&
    typeof candidate.stage === "string" &&
    typeof candidate.lastActiveAt === "string"
  );
}
