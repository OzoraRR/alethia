"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordCourierSmsCompletion, type PracticeProgress } from "@/features/progress/progress";
import {
  persistPracticeEvent,
  persistProgressSnapshot,
  startPracticeAttempt,
  type PracticeEventMetadata,
  type PracticeEventType,
  type PracticeAttemptResult,
  type RemoteSyncResult,
} from "@/features/progress/supabase-persistence";
import {
  loadCourierChallenge,
  saveCourierChallenge,
  clearCourierChallenge,
} from "@/features/simulation/challenge-persistence";
import { getSessionId } from "@/lib/session/session";
import { getMessages, type Messages } from "@/lib/i18n";
import { courierScenarios, type CourierScenarioCopy } from "../scenario-data";
import { initialSimulationState, simulationReducer, type SimulationState } from "../simulation-machine";
import type { Decision, SimulationStage } from "../types";

type SimulationMessages = Messages["simulation"];
type ScenarioCopy = SimulationMessages["scenarios"][CourierScenarioCopy];
type Copy = Messages["simulation"]["redesign"];
type InspectionValues = { sender: string; link: string; tracking: string };

const decisionOptions: ReadonlyArray<{ choiceKey: "openLink" | "verifyOfficial" | "reportDelete"; decision: Decision; marker: string }> = [
  { choiceKey: "openLink", decision: "open_link", marker: "↗" },
  { choiceKey: "verifyOfficial", decision: "verify_official_channel", marker: "✓" },
  { choiceKey: "reportDelete", decision: "report_delete", marker: "×" },
];

const learnerCheckpointKeys = ["receive", "inspect", "verify", "decide", "understand"] as const;
const learnerCheckpointIndex: Record<SimulationStage, number> = {
  briefing: 0,
  receive: 0,
  inspect: 1,
  verify: 2,
  decide: 3,
  reveal: 4,
  retry: 3,
  complete: 4,
};
// Hydration-safe: state is restored from localStorage after mount via useEffect

export function CourierSmsSimulation() {
  const messages = getMessages();
  const simulation = messages.simulation;
  const copy = simulation.redesign;
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionValues, setInspectionValues] = useState<InspectionValues>({ sender: "", link: "", tracking: "" });
  const [inspectionSubmitted, setInspectionSubmitted] = useState(false);
  const [verificationChecked, setVerificationChecked] = useState<boolean>(false);
  const completionRecorded = useRef(false);
  const hasStartedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const attemptPromiseRef = useRef<Promise<PracticeAttemptResult> | null>(null);
  const recordedEventKeysRef = useRef(new Set<string>());
  const [completionProgress, setCompletionProgress] = useState<PracticeProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncResult["status"] | null>(null);

  // Restore state from localStorage after mount (hydration-safe)
  useEffect(() => {
    const saved = loadCourierChallenge();
    if (saved && !saved.isCompleted && saved.stage !== "complete") {
      dispatch({
        type: "restore_state",
        state: {
          stage: saved.stage,
          inspectedSignals: saved.inspectedSignals ?? [],
          retryInspectedSignals: saved.retryInspectedSignals ?? [],
          inspectionComplete: saved.stage !== "briefing" && saved.stage !== "receive" && saved.stage !== "inspect",
          verificationComplete: ["decide", "reveal", "retry", "complete"].includes(saved.stage),
          verificationOpen: saved.verificationOpen ?? false,
          decision: saved.decision ?? null,
          retryDecision: saved.retryDecision ?? null,
        },
      });
      setVerificationChecked(saved.verificationChecked ?? false);
      attemptIdRef.current = saved.attemptId ?? null;
      hasStartedRef.current = saved.stage !== "briefing";
    }
  }, []);

  const isRetryScenario = state.stage === "retry" || state.retryDecision !== null || state.stage === "complete";
  const scenario = simulation.scenarios[(isRetryScenario ? courierScenarios.retry : courierScenarios.primary).copyKey];
  const activeDecision = state.stage === "reveal" || state.stage === "complete"
    ? state.retryDecision ?? state.decision
    : null;

  // Persist state changes across navigation and page refresh
  useEffect(() => {
    if (state.stage === "complete") {
      clearCourierChallenge();
    } else if (state.stage !== "briefing") {
      hasStartedRef.current = true;
      saveCourierChallenge({
        sessionId: getSessionId(),
        stage: state.stage,
        inspectedSignals: state.inspectedSignals,
        retryInspectedSignals: state.retryInspectedSignals,
        verificationOpen: state.verificationOpen,
        verificationChecked,
        decision: state.decision,
        retryDecision: state.retryDecision,
        attemptId: attemptIdRef.current,
        lastUpdated: new Date().toISOString(),
        isCompleted: false,
      });
    }
  }, [state, verificationChecked]);

  const ensureAttempt = useCallback(() => {
    if (attemptPromiseRef.current) return attemptPromiseRef.current;
    const attemptPromise = startPracticeAttempt("courier-sms")
      .then((result) => {
        attemptIdRef.current = result.attemptId;
        return result;
      })
      .catch(() => ({ attemptId: null, status: "local_only" as const, reason: "remote_error" as const }));
    attemptPromiseRef.current = attemptPromise;
    return attemptPromise;
  }, []);

  const recordEvent = useCallback(
    (key: string, eventType: PracticeEventType, stage: SimulationStage, metadata?: PracticeEventMetadata) => {
      if (recordedEventKeysRef.current.has(key)) return;
      recordedEventKeysRef.current.add(key);
      void ensureAttempt()
        .then(({ attemptId }) => persistPracticeEvent({ attemptId, eventType, stage, metadata }))
        .catch(() => undefined);
    },
    [ensureAttempt],
  );

  const inspectSignal = (signal: "sender" | "link", retry = false) => {
    recordEvent(
      `${retry ? "retry-" : ""}inspect:${signal}`,
      signal === "sender" ? "sender_inspected" : "link_inspected",
      retry ? "retry" : "inspect",
      { signal },
    );
    dispatch(retry ? { type: "inspect_retry_signal", signal } : { type: "inspect_signal", signal });
  };

  useEffect(() => {
    if (hasStartedRef.current && state.stage !== "briefing") {
      recordEvent(`stage:${state.stage}:${state.retryDecision ?? "primary"}`, "stage_viewed", state.stage);
    }
  }, [recordEvent, state.retryDecision, state.stage]);

  useEffect(() => {
    if (!activeDecision || state.stage !== "reveal") return;
    recordEvent(`decision-view:${activeDecision}`, "attacker_pov_viewed", "reveal", { choice: activeDecision });
    recordEvent(`feedback:${activeDecision}`, "feedback_viewed", "reveal", { choice: activeDecision });
  }, [activeDecision, recordEvent, state.stage]);

  useEffect(() => {
    if (state.stage !== "complete" || !state.retryDecision || completionRecorded.current) return;
    completionRecorded.current = true;
    const outcome = state.retryDecision === "open_link" ? "unsafe" : "safe";
    recordEvent("module_completed", "module_completed", "complete", { outcome });
    const nextProgress = recordCourierSmsCompletion({ retryDecision: state.retryDecision });
    setCompletionProgress(nextProgress);
    void ensureAttempt()
      .then(({ attemptId }) => {
        if (!attemptId) {
          setSyncStatus("local_only");
          return null;
        }
        return persistProgressSnapshot({ progress: nextProgress, moduleId: "courier-sms", attemptId });
      })
      .then((result) => {
        if (result) setSyncStatus(result.status);
      })
      .catch(() => setSyncStatus("local_only"));
  }, [ensureAttempt, recordEvent, state.retryDecision, state.stage]);

  const begin = () => {
    hasStartedRef.current = true;
    recordEvent("module-started", "module_started", "briefing");
    dispatch({ type: "start_module" });
  };
  const startModule = begin;
  const selectPrimaryDecision = (decision: Decision) => {
    recordEvent("decision:primary", "decision_selected", "decide", { choice: decision });
    dispatch({ type: "select_decision", decision });
  };

  const selectRetryDecision = (decision: Decision) => {
    recordEvent("decision:retry", "decision_selected", "retry", { choice: decision });
    dispatch({ type: "select_retry_decision", decision });
  };

  const openTrustedChannel = () => {
    setVerificationChecked(false);
    dispatch({ type: "open_trusted_channel" });
  };

  const checkTrustedChannel = () => {
    setVerificationChecked(true);
    recordEvent("official_channel_verified", "official_channel_verified", "verify", { channel: "official_app" });
  };

  const advanceOutcome = () => {
    if (state.retryDecision) {
      dispatch({ type: "complete_module" });
      return;
    }
  };
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      {state.stage === "briefing" ? (
        <BriefingBanner onBegin={startModule} scenario={scenario} simulation={simulation} />
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.1em] text-signal">{simulation.briefing.label}</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ice sm:text-4xl">
              {simulation.briefing.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
              {simulation.briefing.description}
            </p>
          </div>
          <p className="border border-signal/30 px-3 py-2 font-mono text-xs text-signal">{simulation.safeNote}</p>
        </header>
      )}

      <StageProgress activeStage={state.stage} simulation={simulation} />

      {state.stage === "briefing" ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-navy-700 pb-6">
          <span className="font-mono text-xs text-muted">{simulation.briefing.checkpointCount}</span>
          <DeviceAction onClick={startModule}>{simulation.briefing.begin}</DeviceAction>
        </div>
      ) : (
        <>
          <div className="relative mt-7 grid gap-7 lg:grid-cols-2 lg:gap-12">
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 hidden h-px w-12 -translate-x-1/2 bg-signal/30 lg:block"
            />
            <VictimDevice
              activeDecision={activeDecision}
              copy={copy}
              inspectionSubmitted={inspectionSubmitted}
              onCheckTrustedChannel={checkTrustedChannel}
              onContinueInspect={() => dispatch({ type: "continue_inspect" })}
              onContinueReceive={() => {
                setInspectionOpen(true);
                dispatch({ type: "continue_receive" });
              }}
              onConfirmTrustedChannel={() => dispatch({ type: "confirm_verification" })}
              onInspectSignal={(signal) => {
                setInspectionOpen(true);
                inspectSignal(signal, state.stage === "retry");
              }}
              onOpenTrustedChannel={openTrustedChannel}
              onSelectDecision={state.stage === "retry" ? selectRetryDecision : selectPrimaryDecision}
              inspectionOpen={inspectionOpen}
              inspectionValues={inspectionValues}
              onInspectionChange={(field, value) => setInspectionValues((current) => ({ ...current, [field]: value }))}
              onInspectionSubmit={() => setInspectionSubmitted(true)}
              onCloseInspection={() => setInspectionOpen(false)}
              scenario={scenario}
              simulation={simulation}
              state={state}
              verificationChecked={verificationChecked}
            />
            <AttackerDevice
              decision={activeDecision}
              isRetryOutcome={isRetryScenario}
              onAdvanceOutcome={advanceOutcome}
              simulation={simulation}
              state={state}
              verificationChecked={verificationChecked}
            />
          </div>
          {state.stage === "complete" ? (
            <CompletionSummary
              progress={completionProgress}
              simulation={simulation}
              syncNotice={syncStatus === "local_only" ? messages.progress.syncPending : null}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function StageProgress({ activeStage, simulation }: { activeStage: SimulationStage; simulation: SimulationMessages }) {
  const activeIndex = learnerCheckpointIndex[activeStage];
  return (
    <ol className="mt-7 grid grid-cols-5 border-y border-white/[0.08]" aria-label={simulation.flowLabel}>
      {learnerCheckpointKeys.map((checkpoint, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        return (
          <li
            key={checkpoint}
            aria-current={isActive ? "step" : undefined}
            className={`min-w-0 border-b-2 px-2 py-3 font-mono text-[11px] leading-4 sm:px-3 ${isActive
                ? "border-signal text-signal"
                : isComplete
                  ? "border-ice/50 text-ice"
                  : "border-transparent text-muted"
              }`}
          >
            <span className="hidden sm:inline">{isComplete ? "✓ " : `${index + 1} `}</span>
            {simulation.checkpoints[checkpoint]}
          </li>
        );
      })}
    </ol>
  );
}

function BriefingBanner({
  onBegin,
  scenario,
  simulation,
}: {
  onBegin: () => void;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
}) {
  const points = [
    scenario.senderInspectionTitle,
    scenario.linkInspectionTitle,
    simulation.decide.title,
  ];
  return (
    <section aria-label={simulation.briefing.title} className="container-level-2 relative overflow-hidden">
      <Image alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-right" fill sizes="100vw" src="/media/sms-phishing.webp" unoptimized />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-transparent" />
      <div className="relative p-6 sm:p-8 lg:max-w-2xl">
        <p className="font-mono text-xs tracking-[0.14em] text-signal">{simulation.briefing.label}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-ice sm:text-5xl">
          {simulation.briefing.title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-base">
          {simulation.briefing.description}
        </p>
        <p className="mt-5 inline-block border border-signal/30 px-3 py-2 font-mono text-xs text-signal">
          {simulation.safeNote}
        </p>
        <ol className="mt-7 border-t border-navy-700/80">
          {points.map((point, index) => (
            <li className="flex items-baseline gap-3 border-b border-navy-700/80 py-3" key={point}>
              <span className="font-mono text-[11px] text-signal">0{index + 1}</span>
              <span className="text-sm text-ice">{point}</span>
            </li>
          ))}
        </ol>
        <button className="mt-7 font-mono text-xs text-muted hover:text-ice" onClick={onBegin} type="button">
          {simulation.briefing.begin} →
        </button>
      </div>
    </section>
  );
}

function VictimDevice({
  activeDecision,
  copy,
  onCheckTrustedChannel,
  onContinueInspect,
  onContinueReceive,
  onConfirmTrustedChannel,
  onInspectSignal,
  onOpenTrustedChannel,
  onSelectDecision,
  inspectionOpen,
  inspectionValues,
  onInspectionChange,
  onInspectionSubmit,
  onCloseInspection,
  inspectionSubmitted,
  scenario,
  simulation,
  state,
  verificationChecked,
}: {
  activeDecision: Decision | null;
  copy: Copy;
  onCheckTrustedChannel: () => void;
  onContinueInspect: () => void;
  onContinueReceive: () => void;
  onConfirmTrustedChannel: () => void;
  onInspectSignal: (signal: "sender" | "link") => void;
  onOpenTrustedChannel: () => void;
  onSelectDecision: (decision: Decision) => void;
  inspectionOpen: boolean;
  inspectionValues: InspectionValues;
  onInspectionChange: (field: keyof InspectionValues, value: string) => void;
  onInspectionSubmit: () => void;
  onCloseInspection: () => void;
  inspectionSubmitted: boolean;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
  state: SimulationState;
  verificationChecked: boolean;
}) {
  const isRetry = state.stage === "retry";
  const inspectedSignals = isRetry ? state.retryInspectedSignals : state.inspectedSignals;
  const hasSender = inspectedSignals.includes("sender");
  const hasLink = inspectedSignals.includes("link");
  const isOutcome = state.stage === "reveal" || state.stage === "complete";

  return (
    <section className="mx-auto w-full max-w-[25rem]" aria-label={simulation.devices.victim}>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="font-mono text-xs tracking-[0.12em] text-muted uppercase font-medium">
          [ {simulation.devices.victim} ]
        </p>
        <span className="font-mono text-[10px] text-signal/70">WORKSTATION DISPATCH</span>
      </div>
      <div className="container-level-3 device-phone rounded-[2rem] p-2.5">
        <div className="device-screen rounded-[1.5rem] bg-navy-950">
          {state.verificationOpen ? (
            <TrustedCourierApp
              checked={verificationChecked}
              onCheck={onCheckTrustedChannel}
              onConfirm={onConfirmTrustedChannel}
              simulation={simulation}
            />
          ) : isOutcome && activeDecision ? (
            <VictimOutcome decision={activeDecision} simulation={simulation} />
          ) : (
            <>
              <SmsHeader scenario={scenario} simulation={simulation} />
              <div className="min-h-[24rem] space-y-4 bg-navy-900/40 px-4 py-6">
                <p className="text-center font-mono text-[10px] text-muted">{scenario.timestamp}</p>
                <MessageBubble scenario={scenario} simulation={simulation} />
              </div>
              <div className="border-t border-navy-700/80 bg-navy-950 p-4">
                {state.stage === "receive" ? (
                  <DeviceAction onClick={onContinueReceive}>{simulation.receive.action}</DeviceAction>
                ) : null}
                {state.stage === "inspect" || state.stage === "retry" ? (
                  <InspectionControls
                    copy={copy}
                    hasLink={hasLink}
                    hasSender={hasSender}
                    isRetry={isRetry}
                    onContinue={onContinueInspect}
                    onInspect={onInspectSignal}
                    onSelectDecision={onSelectDecision}
                    inspectionOpen={inspectionOpen}
                    inspectionValues={inspectionValues}
                    onInspectionChange={onInspectionChange}
                    onInspectionSubmit={onInspectionSubmit}
                    onCloseInspection={onCloseInspection}
                    inspectionSubmitted={inspectionSubmitted}
                    scenario={scenario}
                    simulation={simulation}
                  />
                ) : null}
                {state.stage === "verify" ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-muted">{simulation.verify.description}</p>
                    <DeviceAction onClick={onOpenTrustedChannel}>{simulation.verify.action}</DeviceAction>
                  </div>
                ) : null}
                {state.stage === "decide" ? (
                  <DecisionChoices choices={simulation.decide.choices} onSelect={onSelectDecision} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Input({ label, onChange, value }: { label: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; value: string }) { return <label className="block font-mono text-[10px] text-muted">{label}<input className="mt-2 w-full border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-ice" value={value} onChange={onChange} /></label>; }
function SmsHeader({ scenario, simulation }: { scenario: ScenarioCopy; simulation: SimulationMessages }) {
  return (
    <>
      <div className="flex justify-center pt-2">
        <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-navy-700" />
      </div>
      <div className="flex items-center justify-between px-4 py-3 font-mono text-[10px] text-muted">
        <span>{simulation.phoneTime}</span>
        <span className="text-signal">{simulation.phoneLabel}</span>
      </div>
      <div className="border-y border-white/[0.08] px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-signal/15 font-mono text-xs text-signal"
          >
            {scenario.senderName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-bold text-ice">{scenario.senderName}</p>
            <p className="mt-1 font-mono text-[10px] text-muted">{scenario.senderNumber}</p>
          </div>
        </div>
        <span className="mt-3 inline-flex border border-warning/30 px-2 py-1 font-mono text-[10px] text-warning">
          {scenario.senderMarker}
        </span>
      </div>
    </>
  );
}

function MessageBubble({ scenario, simulation }: { scenario: ScenarioCopy; simulation: SimulationMessages }) {
  return (
    <>
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-navy-700 bg-navy-850 p-4 text-sm leading-6 text-ice">
        <p>{scenario.messageGreeting}</p>
        <p className="mt-3">{scenario.messageUrgency}</p>
        <p className="mt-4 break-words border-t border-white/[0.08] pt-3 font-mono text-xs text-signal">
          {scenario.messageLink}
        </p>
      </div>
      <p className="text-center font-mono text-[10px] text-muted">{simulation.messageFooter}</p>
    </>
  );
}

function InspectionControls({
  copy,
  hasLink,
  hasSender,
  isRetry,
  onContinue,
  onInspect,
  onSelectDecision,
  inspectionOpen,
  inspectionValues,
  onInspectionChange,
  onInspectionSubmit,
  onCloseInspection,
  inspectionSubmitted,
  scenario,
  simulation,
}: {
  copy: Copy;
  hasLink: boolean;
  hasSender: boolean;
  isRetry: boolean;
  onContinue: () => void;
  onInspect: (signal: "sender" | "link") => void;
  onSelectDecision: (decision: Decision) => void;
  inspectionOpen: boolean;
  inspectionValues: InspectionValues;
  onInspectionChange: (field: keyof InspectionValues, value: string) => void;
  onInspectionSubmit: () => void;
  onCloseInspection: () => void;
  inspectionSubmitted: boolean;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
}) {
  const canContinue = hasSender || hasLink;
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-ice">
        {isRetry ? simulation.retryStep.inspectPrompt : simulation.inspect.title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <InspectButton active={hasSender} label={simulation.inspect.senderAction} onClick={() => onInspect("sender")} />
        <InspectButton active={hasLink} label={simulation.inspect.linkAction} onClick={() => onInspect("link")} />
      </div>
      {hasSender ? (
        <div className="border-l-2 border-warning/50 pl-3">
          <p className="font-mono text-[11px] text-warning">{scenario.senderInspectionTitle}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{scenario.senderInspectionBody}</p>
        </div>
      ) : null}
      {hasLink ? (
        <div className="border-l-2 border-warning/50 pl-3">
          <p className="font-mono text-[11px] text-warning">{scenario.linkInspectionTitle}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{scenario.linkInspectionBody}</p>
        </div>
      ) : null}
      {inspectionOpen ? (
        <div className="border border-signal/30 bg-navy-950 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] text-signal">{copy.message.label}</p>
            <button className="font-mono text-[10px] text-signal" type="button" onClick={onCloseInspection}>{copy.inspect.back}</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">{copy.inspect.description}</p>
          <div className="mt-3 space-y-3">
            <Input label={copy.inspect.sender} onChange={(event) => onInspectionChange("sender", event.target.value)} value={inspectionValues.sender} />
            <Input label={copy.inspect.link} onChange={(event) => onInspectionChange("link", event.target.value)} value={inspectionValues.link} />
            <Input label={copy.inspect.tracking} onChange={(event) => onInspectionChange("tracking", event.target.value)} value={inspectionValues.tracking} />
          </div>
          <button className="mt-3 min-h-10 border border-signal px-3 font-mono text-xs text-signal" type="button" onClick={onInspectionSubmit}>{copy.inspect.submit}</button>
          {inspectionSubmitted ? <p className="mt-2 text-xs text-muted">{copy.inspect.resultTitle}</p> : null}
        </div>
      ) : null}
      <p className="text-xs leading-5 text-muted">
        {canContinue ? scenario.signalSummary : simulation.inspect.requirement}
      </p>
      {isRetry ? (
        <div className="border-t border-white/[0.08] pt-3">
          <p className="mb-3 font-mono text-xs text-ice">{simulation.retryStep.question}</p>
          <DecisionChoices choices={simulation.decide.choices} disabled={!canContinue} onSelect={onSelectDecision} />
        </div>
      ) : (
        <DeviceAction disabled={!canContinue} onClick={onContinue}>
          {simulation.inspect.continue}
        </DeviceAction>
      )}
    </div>
  );
}

function InspectButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-11 border px-3 py-2 text-left font-mono text-xs ${active ? "border-signal/50 text-signal" : "border-white/[0.1] text-ice hover:border-signal/50"
        }`}
      disabled={active}
      type="button"
      onClick={onClick}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );
}

function TrustedCourierApp({
  checked,
  onCheck,
  onConfirm,
  simulation,
}: {
  checked: boolean;
  onCheck: () => void;
  onConfirm: () => void;
  simulation: SimulationMessages;
}) {
  return (
    <div className="min-h-full bg-[#e7eee9] px-5 py-6 text-[#16241e]">
      <div className="mx-auto h-1.5 w-16 rounded-full bg-[#789084]" />
      <div className="mt-8 flex items-center justify-between">
        <p className="font-mono text-xs font-bold tracking-[0.12em]">{simulation.verify.appTitle}</p>
        <span className="text-xs">{simulation.verify.appSimulation}</span>
      </div>
      <h2 className="mt-12 text-2xl font-semibold">{simulation.verify.trackTitle}</h2>
      <div className="mt-5 border border-[#aab9ae] bg-white px-4 py-3 font-mono text-sm text-[#617066]">
        {simulation.verify.trackingPlaceholder}
      </div>
      {!checked ? (
        <button
          className="mt-4 min-h-11 bg-[#193c2e] px-4 font-mono text-xs text-white"
          type="button"
          onClick={onCheck}
        >
          {simulation.verify.search}
        </button>
      ) : (
        <div className="mt-6 border-l-4 border-[#2f6c4c] bg-white p-4">
          <p className="font-mono text-xs text-[#2f6c4c]">{simulation.verify.searchResultLabel}</p>
          <p className="mt-2 text-sm leading-6">{simulation.verify.orderStatus}</p>
          <p className="mt-2 text-xs leading-5 text-[#53635a]">{simulation.verify.orderStatusDescription}</p>
          <button
            className="mt-5 min-h-10 border border-[#193c2e] px-4 font-mono text-xs text-[#193c2e]"
            type="button"
            onClick={onConfirm}
          >
            {simulation.verify.continue}
          </button>
        </div>
      )}
    </div>
  );
}

function DecisionChoices({
  choices,
  disabled = false,
  onSelect,
}: {
  choices: SimulationMessages["decide"]["choices"];
  disabled?: boolean;
  onSelect: (decision: Decision) => void;
}) {
  return (
    <div className="grid gap-2">
      {decisionOptions.map((option) => {
        const choice = choices[option.choiceKey];
        return (
          <button
            key={option.decision}
            className="flex min-h-12 items-center gap-3 border border-white/[0.1] bg-navy-900 px-3 py-2 text-left transition hover:border-signal/60 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled}
            type="button"
            onClick={() => onSelect(option.decision)}
          >
            <span aria-hidden="true" className="font-mono text-sm text-signal">
              {option.marker}
            </span>
            <span>
              <span className="block font-mono text-xs text-ice">{choice.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted">{choice.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DeviceAction({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950 disabled:cursor-not-allowed disabled:border-navy-700 disabled:bg-navy-800 disabled:text-muted"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children} <span aria-hidden="true" className="ml-2">→</span>
    </button>
  );
}

function VictimOutcome({ decision, simulation }: { decision: Decision; simulation: SimulationMessages }) {
  const choiceKey = decision === "open_link" ? "openLink" : decision === "verify_official_channel" ? "verifyOfficial" : "reportDelete";
  const choice = simulation.decide.choices[choiceKey];
  const outcome =
    decision === "open_link"
      ? simulation.outcomes.openLink
      : decision === "report_delete"
        ? simulation.outcomes.reportDelete
        : simulation.outcomes.verifyOfficial;

  return (
    <div className="min-h-full bg-navy-900 px-5 py-6">
      <p className="font-mono text-xs text-muted">{simulation.devices.victim}</p>
      <h2 className="mt-10 text-2xl font-semibold text-ice">{choice.label}</h2>
      {decision === "open_link" ? (
        <div className="mt-6 rounded-xl border border-warning/30 bg-navy-950 p-5">
          <p className="font-mono text-xs text-warning">{simulation.outcomes.simulatedPage}</p>
          <p className="mt-4 text-lg text-ice">{simulation.outcomes.deliveryPortal}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{outcome.detail}</p>
          <div className="mt-6 border border-navy-700 px-3 py-3 font-mono text-xs text-muted">
            {simulation.outcomes.noDataField}
          </div>
        </div>
      ) : (
        <div className="mt-6 border-l-4 border-signal bg-signal/[0.05] p-4 text-sm leading-6 text-ice">
          {outcome.detail}
        </div>
      )}
      <p className="mt-8 text-sm leading-6 text-muted">{outcome.summary}</p>
    </div>
  );
}

function AttackerDevice({
  decision,
  isRetryOutcome,
  onAdvanceOutcome,
  simulation,
  state,
  verificationChecked,
}: {
  decision: Decision | null;
  isRetryOutcome: boolean;
  onAdvanceOutcome: () => void;
  simulation: SimulationMessages;
  state: SimulationState;
  verificationChecked: boolean;
}) {
  const [visibleOutcomeEvents, setVisibleOutcomeEvents] = useState(0);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const outcomeEvents = decision ? outcomeEventsFor(decision, simulation) : [];
  const traceFinished = !decision || visibleOutcomeEvents >= outcomeEvents.length;
  const feedback = decision ? feedbackFor(decision, simulation) : null;
  const events = campaignEventsFor(state, simulation, verificationChecked, isRetryOutcome);

  useEffect(() => {
    setVisibleOutcomeEvents(0);
    setAnalysisExpanded(false);
    if (!decision) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleOutcomeEvents(outcomeEvents.length);
      return;
    }
    const timer = window.setInterval(
      () => setVisibleOutcomeEvents((count) => Math.min(count + 1, outcomeEvents.length)),
      360,
    );
    return () => window.clearInterval(timer);
  }, [decision, outcomeEvents.length]);

  const allEvents = [...events, ...outcomeEvents.slice(0, visibleOutcomeEvents)];
  const status =
    decision && traceFinished
      ? finalStatusFor(decision, simulation)
      : campaignStatusFor(state, simulation, verificationChecked, isRetryOutcome);

  return (
    <section className="mx-auto w-full max-w-[25rem]" aria-label={simulation.devices.attacker}>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="font-mono text-xs tracking-[0.12em] text-muted uppercase font-medium">
          [ {simulation.devices.attacker} ]
        </p>
        <span className="font-mono text-[10px] text-warning/80">LIVE TELEMETRY MONITOR</span>
      </div>
      <div className="container-level-3 device-phone rounded-[2rem] p-2.5">
        <div className="device-screen rounded-[1.5rem] bg-[#05090d]">
          <div className="flex justify-center pt-2">
            <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-navy-700" />
          </div>
          <div className="border-b border-navy-700/80 px-4 pb-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs font-bold tracking-[0.08em] text-ice">
                {simulation.console.campaignTitle}
              </p>
              <span className="font-mono text-[10px] text-signal font-medium">
                {isRetryOutcome ? simulation.console.roundRetry : simulation.console.roundPrimary}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[10px] leading-4">
              <CampaignField label={simulation.console.campaignLabel} value={simulation.console.campaignValue} />
              <CampaignField label={simulation.console.targetLabel} value={simulation.console.targetValue} />
              <CampaignField label={simulation.console.objectiveLabel} value={simulation.console.objective} wide />
              <CampaignField
                label={simulation.console.tacticLabel}
                value={isRetryOutcome ? simulation.console.retryTactic : simulation.console.tactic}
                wide
              />
            </dl>
          </div>
          <div className="px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{simulation.console.liveLogLabel}</p>
              <span className="font-mono text-[10px] text-warning font-semibold border border-warning/30 px-2 py-0.5 bg-warning/5">
                {status}
              </span>
            </div>
            <ol className="mt-4 min-h-[17rem] space-y-2 border-l border-navy-700/80 pl-3" aria-live="polite">
              {allEvents.map((event, index) => (
                <li key={`${event}-${index}`} className="font-mono text-[11px] leading-5 text-ice">
                  <span className="mr-2 text-muted">[{eventTime(index)}]</span>
                  {event}
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-navy-700/80 pt-3">
              <p className="font-mono text-[10px] text-muted uppercase">{simulation.console.nextActionLabel}</p>
              <p className="mt-1 font-mono text-xs leading-5 text-ice">
                {nextActionFor(state, decision, simulation, isRetryOutcome)}
              </p>
            </div>
          </div>
          {decision && traceFinished && feedback ? (
            <div className="border-t border-navy-700/80 bg-navy-950/95 p-3">
              <div aria-hidden="true" className="mx-auto mt-1 mb-2 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-start justify-between gap-4 px-2 pb-2">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] text-signal font-bold uppercase">{simulation.reveal.notificationLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-ice">{feedback.whatHappened}</p>
                </div>
                <button
                  aria-expanded={analysisExpanded}
                  className="shrink-0 font-mono text-xs text-signal hover:underline"
                  type="button"
                  onClick={() => setAnalysisExpanded((expanded) => !expanded)}
                >
                  {analysisExpanded ? simulation.reveal.hideAnalysis : simulation.reveal.viewAnalysis}
                </button>
              </div>
              {analysisExpanded ? <AnalysisPanel feedback={feedback} simulation={simulation} /> : null}
            </div>
          ) : null}
          {decision && traceFinished && state.stage !== "complete" ? (
            <div className="border-t border-navy-700/80 px-4 py-4">
              <button
                className="font-mono text-xs text-signal hover:text-signal/80 flex items-center gap-2"
                type="button"
                onClick={onAdvanceOutcome}
              >
                <span>{isRetryOutcome ? simulation.reveal.finish : simulation.reveal.retry}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CampaignField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-ice font-medium">{value}</dd>
    </div>
  );
}

function AnalysisPanel({
  feedback,
  simulation,
}: {
  feedback: SimulationMessages["reveal"]["safeFeedback"];
  simulation: SimulationMessages;
}) {
  return (
    <div className="forensic-diagnostic-panel p-3.5 my-2">
      <div className="flex items-center justify-between border-b border-navy-700/80 pb-2 mb-3">
        <span className="font-mono text-[10px] tracking-[0.14em] text-signal font-bold">ANALYSIS COMPLETE</span>
        <span className="font-mono text-[10px] text-muted uppercase">FORENSIC DIAGNOSTIC</span>
      </div>
      <dl className="space-y-3">
        <AnalysisRow label={simulation.reveal.fields.whatHappened} value={feedback.whatHappened} />
        <AnalysisRow label={simulation.reveal.fields.attackerObjective} value={feedback.attackerObjective} />
        <AnalysisRow label={simulation.reveal.fields.technique} value={feedback.technique} />
        <AnalysisRow label={simulation.reveal.fields.saferResponse} value={feedback.saferResponse} />
      </dl>
    </div>
  );
}

function AnalysisRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] text-muted uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-xs leading-5 text-ice">{value}</dd>
    </div>
  );
}

function CompletionSummary({
  progress,
  simulation,
  syncNotice,
}: {
  progress: PracticeProgress | null;
  simulation: SimulationMessages;
  syncNotice: string | null;
}) {
  return (
    <section className="mx-auto mt-7 flex max-w-[52rem] flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
      <div>
        <p className="font-mono text-xs text-signal">{simulation.complete.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {progress ? simulation.complete.skillUpdate : simulation.complete.description}
        </p>
        {syncNotice ? (
          <p className="mt-2 font-mono text-[11px] text-warning" role="status">
            {syncNotice}
          </p>
        ) : null}
      </div>
      <Link className="font-mono text-xs text-signal" href="/dashboard">
        {simulation.complete.backHome} →
      </Link>
    </section>
  );
}

function campaignEventsFor(
  state: SimulationState,
  simulation: SimulationMessages,
  verificationChecked: boolean,
  isRetryRound: boolean,
): string[] {
  const inspectedSignals = isRetryRound ? state.retryInspectedSignals : state.inspectedSignals;
  const events = isRetryRound ? [...simulation.console.retryInitialEvents] : [...simulation.console.initialEvents];
  if (isRetryRound || state.stage !== "receive") events.push(simulation.console.messageOpened);
  if (inspectedSignals.includes("sender")) events.push(simulation.console.senderInspected, simulation.console.responseDelay);
  if (inspectedSignals.includes("link")) events.push(simulation.console.linkInspected, simulation.console.domainMismatch);
  if (!isRetryRound && (state.verificationOpen || verificationChecked)) events.push(simulation.console.trustedCheckDetected);
  if (!isRetryRound && verificationChecked) events.push(simulation.console.trackingNotFound, simulation.console.confidenceDeclining);
  return events;
}

function outcomeEventsFor(decision: Decision, simulation: SimulationMessages): string[] {
  if (decision === "open_link") return simulation.console.traceUnsafe;
  if (decision === "report_delete") return simulation.console.traceReport;
  return simulation.console.traceSafe;
}

function feedbackFor(decision: Decision, simulation: SimulationMessages) {
  if (decision === "open_link") return simulation.reveal.unsafeFeedback;
  return simulation.reveal.safeFeedback;
}

function campaignStatusFor(
  state: SimulationState,
  simulation: SimulationMessages,
  verificationChecked: boolean,
  isRetryRound: boolean,
): string {
  if (isRetryRound) return simulation.console.statusRetry;
  if (verificationChecked) return simulation.console.statusDeclining;
  if (state.verificationOpen) return simulation.console.statusObserved;
  if (state.stage === "inspect") return simulation.console.statusRisk;
  return simulation.console.statusWaiting;
}

function finalStatusFor(decision: Decision, simulation: SimulationMessages): string {
  return decision === "open_link"
    ? simulation.console.unsafeStatus
    : decision === "report_delete"
      ? simulation.console.interruptedStatus
      : simulation.console.safeStatus;
}

function nextActionFor(
  state: SimulationState,
  decision: Decision | null,
  simulation: SimulationMessages,
  isRetryRound: boolean,
): string {
  if (decision) return simulation.console.nextActionComplete;
  if (state.stage === "decide") return simulation.console.nextActionDecide;
  if (state.stage === "verify") return simulation.console.nextActionVerify;
  if (state.stage === "inspect") return simulation.console.nextActionInspect;
  if (isRetryRound) return simulation.console.nextActionRetry;
  return simulation.console.nextActionWaiting;
}

function eventTime(index: number): string {
  return `09:41:${String(8 + index * 2).padStart(2, "0")}`;
}
