"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordCourierSmsCompletion, type PracticeProgress } from "@/features/progress/progress";
import {
  persistPracticeEvent,
  persistProgressSnapshot,
  startPracticeAttempt,
  type PracticeEventMetadata,
  type PracticeEventType,
} from "@/features/progress/supabase-persistence";
import { getMessages, type Messages } from "@/lib/i18n";
import { courierScenarios, type CourierScenarioCopy } from "../scenario-data";
import {
  initialSimulationState,
  simulationReducer,
  type SimulationAction,
  type SimulationState,
} from "../simulation-machine";
import { simulationStages, type Decision, type SimulationStage } from "../types";

type SimulationMessages = Messages["simulation"];
type ScenarioCopy = SimulationMessages["scenarios"][CourierScenarioCopy];
type ChoiceKey = "openLink" | "verifyOfficial" | "reportDelete";

const decisionOptions: ReadonlyArray<{
  choiceKey: ChoiceKey;
  decision: Decision;
  marker: string;
}> = [
  { choiceKey: "openLink", decision: "open_link", marker: "↗" },
  { choiceKey: "verifyOfficial", decision: "verify_official_channel", marker: "✓" },
  { choiceKey: "reportDelete", decision: "report_delete", marker: "×" },
];

const choiceKeyByDecision: Record<Decision, ChoiceKey> = {
  open_link: "openLink",
  verify_official_channel: "verifyOfficial",
  report_delete: "reportDelete",
};

export function CourierSmsSimulation() {
  const messages = getMessages();
  const simulation = messages.simulation;
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const completionRecorded = useRef(false);
  const hasStartedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const attemptPromiseRef = useRef<Promise<string | null> | null>(null);
  const recordedEventKeysRef = useRef(new Set<string>());
  const [completionProgress, setCompletionProgress] = useState<PracticeProgress | null>(null);
  const scenario = state.stage === "retry" ? courierScenarios.retry : courierScenarios.primary;
  const scenarioCopy = simulation.scenarios[scenario.copyKey];
  const showAttackerPov = state.stage === "reveal";

  const ensureAttempt = useCallback(() => {
    if (!attemptPromiseRef.current) {
      attemptPromiseRef.current = startPracticeAttempt()
        .then((attemptId) => {
          attemptIdRef.current = attemptId;
          return attemptId;
        })
        .catch(() => null);
    }

    return attemptPromiseRef.current;
  }, []);

  const recordEvent = useCallback(
    (
      key: string,
      eventType: PracticeEventType,
      stage: SimulationStage,
      metadata?: PracticeEventMetadata,
    ) => {
      if (recordedEventKeysRef.current.has(key)) {
        return;
      }

      recordedEventKeysRef.current.add(key);
      void ensureAttempt().then((attemptId) =>
        persistPracticeEvent({ attemptId, eventType, stage, metadata }),
      ).catch(() => undefined);
    },
    [ensureAttempt],
  );

  const beginModule = () => {
    hasStartedRef.current = true;
    recordEvent("module_started", "module_started", "briefing");
    dispatch({ type: "start_module" });
  };

  const inspectSignal = (signal: "sender" | "link") => {
    const eventType: PracticeEventType = signal === "sender" ? "sender_inspected" : "link_inspected";
    recordEvent(`inspect:${signal}`, eventType, "inspect", { signal });
    dispatch({ type: "inspect_signal", signal });
  };

  const inspectRetrySignal = (signal: "sender" | "link") => {
    const eventType: PracticeEventType = signal === "sender" ? "sender_inspected" : "link_inspected";
    recordEvent(`retry-inspect:${signal}`, eventType, "retry", { signal });
    dispatch({ type: "inspect_retry_signal", signal });
  };

  const confirmVerification = () => {
    recordEvent("official_channel_verified", "official_channel_verified", "verify", { channel: "official_app" });
    dispatch({ type: "confirm_verification" });
  };

  const selectDecision = (decision: Decision) => {
    recordEvent("decision:primary", "decision_selected", "decide", { choice: decision });
    dispatch({ type: "select_decision", decision });
  };

  const startRetry = () => {
    recordEvent("retry_started", "retry_started", "reveal", { variant: "retry" });
    dispatch({ type: "start_retry" });
  };

  const selectRetryDecision = (decision: Decision) => {
    recordEvent("decision:retry", "decision_selected", "retry", { choice: decision });
    dispatch({ type: "select_retry_decision", decision });
  };

  useEffect(() => {
    if (!hasStartedRef.current || state.stage === "briefing") {
      return;
    }

    recordEvent(`stage:${state.stage}`, "stage_viewed", state.stage);
  }, [recordEvent, state.stage]);

  useEffect(() => {
    if (state.stage !== "reveal" || state.decision === null) {
      return;
    }

    const metadata = { choice: state.decision };
    recordEvent("attacker_pov_viewed", "attacker_pov_viewed", "reveal", metadata);
    recordEvent("feedback_viewed", "feedback_viewed", "reveal", metadata);
  }, [recordEvent, state.decision, state.stage]);

  useEffect(() => {
    if (state.stage !== "complete" || state.retryDecision === null || completionRecorded.current) {
      return;
    }

    completionRecorded.current = true;
    const outcome = state.retryDecision === "open_link" ? "unsafe" : "safe";
    recordEvent("module_completed", "module_completed", "complete", { outcome });
    const attemptId = attemptIdRef.current;
    const nextProgress = recordCourierSmsCompletion({ retryDecision: state.retryDecision, attemptId });
    setCompletionProgress(nextProgress);
    if (!attemptId) {
      void ensureAttempt().then((resolvedAttemptId) => {
        if (resolvedAttemptId) {
          return persistProgressSnapshot({ progress: nextProgress, attemptId: resolvedAttemptId });
        }

        return undefined;
      }).catch(() => undefined);
    }
  }, [ensureAttempt, recordEvent, state.retryDecision, state.stage]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{simulation.briefing.label}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-5xl">{simulation.briefing.title}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">{simulation.briefing.description}</p>
        </div>
        <p className="border border-signal/30 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-signal">
          {simulation.safeNote}
        </p>
      </header>

      <StageProgress activeStage={state.stage} simulation={simulation} />

      {state.stage === "briefing" ? (
        <BriefingPanel simulation={simulation} onBegin={beginModule} />
      ) : state.stage === "complete" ? (
        <CompletionPanel progress={completionProgress} simulation={simulation} />
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] lg:items-start">
          <PhoneSurface scenario={scenarioCopy} simulation={simulation} />
          {showAttackerPov ? (
            <AttackerConsole
              decision={state.decision ?? "open_link"}
              simulation={simulation}
              onRetry={startRetry}
            />
          ) : state.stage === "retry" ? (
            <RetryPanel
              state={state}
              scenario={scenarioCopy}
              simulation={simulation}
              onInspectSignal={inspectRetrySignal}
              onSelectDecision={selectRetryDecision}
            />
          ) : (
            <StagePanel
              state={state}
              scenario={scenarioCopy}
              simulation={simulation}
              dispatch={dispatch}
              onInspectSignal={inspectSignal}
              onSelectDecision={selectDecision}
              onOpenTrustedChannel={() => dispatch({ type: "open_trusted_channel" })}
            />
          )}
        </div>
      )}

      {state.verificationOpen ? (
        <TrustedChannelSheet
          simulation={simulation}
          onConfirm={confirmVerification}
        />
      ) : null}
    </div>
  );
}

function StageProgress({ activeStage, simulation }: { activeStage: SimulationStage; simulation: SimulationMessages }) {
  const activeIndex = simulationStages.indexOf(activeStage);

  return (
    <ol className="mt-10 flex gap-2 overflow-x-auto pb-2" aria-label={simulation.flowLabel}>
      {simulationStages.map((stage, index) => {
        const isActive = stage === activeStage;
        const isComplete = index < activeIndex;

        return (
          <li
            key={stage}
            aria-current={isActive ? "step" : undefined}
            className={`flex min-w-max items-center gap-2 border px-3 py-2 font-mono text-[10px] tracking-[0.12em] ${
              isActive
                ? "border-signal/60 bg-signal/[0.08] text-signal"
                : isComplete
                  ? "border-navy-700 text-ice"
                  : "border-white/[0.08] text-muted"
            }`}
          >
            <span aria-hidden="true" className="text-[9px]">
              {isComplete ? "✓" : String(index + 1).padStart(2, "0")}
            </span>
            <span>{simulation.stageLabels[stage]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function BriefingPanel({ simulation, onBegin }: { simulation: SimulationMessages; onBegin: () => void }) {
  return (
    <section className="mt-8 border border-signal/40 bg-navy-900 p-6 shadow-panel sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-signal">{simulation.briefing.label}</p>
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted">{simulation.briefing.checkpointCount}</span>
      </div>
      <div className="mt-16 max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{simulation.briefing.title}</h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">{simulation.briefing.description}</p>
      </div>
      <div className="mt-12 flex flex-wrap items-center gap-5 border-t border-white/[0.08] pt-6">
        <button
          className="inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-mono text-xs font-bold tracking-[0.1em] text-navy-950 transition hover:bg-signal/90"
          type="button"
          onClick={onBegin}
        >
          {simulation.briefing.begin}
          <span aria-hidden="true" className="ml-4 text-base">→</span>
        </button>
        <span className="font-mono text-[10px] tracking-[0.1em] text-muted">{simulation.briefing.safeNotice}</span>
      </div>
    </section>
  );
}

function PhoneSurface({ scenario, simulation }: { scenario: ScenarioCopy; simulation: SimulationMessages }) {
  return (
    <section className="border border-navy-700 bg-navy-900 p-4 sm:p-8" aria-label={scenario.senderName}>
      <div className="mx-auto w-full max-w-[22rem] rounded-[2.25rem] border-[7px] border-navy-700 bg-navy-950 p-2 shadow-panel">
        <div className="overflow-hidden rounded-[1.65rem] border border-white/[0.08] bg-navy-950">
          <div className="flex justify-center pt-2">
            <span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-navy-700" />
          </div>
          <div className="flex items-center justify-between px-4 py-3 font-mono text-[9px] text-muted">
            <span>{simulation.phoneTime}</span>
            <span className="text-signal">{simulation.phoneLabel}</span>
          </div>
          <div className="border-y border-white/[0.08] px-4 py-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-signal/15 font-mono text-xs text-signal">
                {scenario.senderName.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-bold text-ice">{scenario.senderName}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">{scenario.senderNumber}</p>
              </div>
            </div>
            <span className="mt-3 inline-flex border border-warning/30 px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-warning">
              {scenario.senderMarker}
            </span>
          </div>
          <div className="min-h-[21rem] space-y-4 bg-navy-900/40 px-4 py-6">
            <p className="text-center font-mono text-[9px] tracking-[0.12em] text-muted">{scenario.timestamp}</p>
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-navy-700 bg-navy-850 p-4 text-sm leading-6 text-ice">
              <p>{scenario.messageGreeting}</p>
              <p className="mt-3">{scenario.messageUrgency}</p>
              <p className="mt-4 break-words border-t border-white/[0.08] pt-3 font-mono text-[11px] text-signal">
                {scenario.messageLink}
              </p>
            </div>
            <p className="text-center font-mono text-[9px] tracking-[0.1em] text-muted">{simulation.messageFooter}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StagePanel({
  state,
  scenario,
  simulation,
  dispatch,
  onInspectSignal,
  onSelectDecision,
  onOpenTrustedChannel,
}: {
  state: SimulationState;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
  dispatch: React.Dispatch<SimulationAction>;
  onInspectSignal: (signal: "sender" | "link") => void;
  onSelectDecision: (decision: Decision) => void;
  onOpenTrustedChannel: () => void;
}) {
  if (state.stage === "receive") {
    return (
      <PanelFrame stage="receive" title={simulation.receive.title} simulation={simulation}>
        <p className="leading-7 text-muted">{simulation.receive.description}</p>
        <AnalystNote>{simulation.receive.analystNote}</AnalystNote>
        <PanelAction onClick={() => dispatch({ type: "continue_receive" })}>{simulation.receive.action}</PanelAction>
      </PanelFrame>
    );
  }

  if (state.stage === "inspect") {
    return <InspectPanel state={state} scenario={scenario} simulation={simulation} dispatch={dispatch} onInspectSignal={onInspectSignal} />;
  }

  if (state.stage === "verify") {
    return (
      <PanelFrame stage="verify" title={simulation.verify.title} simulation={simulation}>
        <p className="leading-7 text-muted">{simulation.verify.description}</p>
        <AnalystNote>{simulation.verify.analystNote}</AnalystNote>
        <PanelAction onClick={onOpenTrustedChannel}>{simulation.verify.action}</PanelAction>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame stage="decide" title={simulation.decide.title} simulation={simulation}>
      <p className="leading-7 text-muted">{simulation.decide.description}</p>
      <AnalystNote>{simulation.decide.analystNote}</AnalystNote>
      <DecisionChoices
        choices={simulation.decide.choices}
        onSelect={onSelectDecision}
      />
    </PanelFrame>
  );
}

function InspectPanel({
  state,
  scenario,
  simulation,
  dispatch,
  onInspectSignal,
}: {
  state: SimulationState;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
  dispatch: React.Dispatch<SimulationAction>;
  onInspectSignal: (signal: "sender" | "link") => void;
}) {
  const hasSender = state.inspectedSignals.includes("sender");
  const hasLink = state.inspectedSignals.includes("link");
  const note = hasSender && hasLink
    ? simulation.inspect.bothInspected
    : hasSender
      ? simulation.inspect.senderAnalystNote
      : hasLink
        ? simulation.inspect.linkAnalystNote
        : simulation.inspect.requirement;

  return (
    <PanelFrame stage="inspect" title={simulation.inspect.title} simulation={simulation}>
      <p className="leading-7 text-muted">{simulation.inspect.description}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <InspectionButton
          inspected={hasSender}
          label={simulation.inspect.senderAction}
          status={simulation.inspect.inspected}
          onClick={() => onInspectSignal("sender")}
        />
        <InspectionButton
          inspected={hasLink}
          label={simulation.inspect.linkAction}
          status={simulation.inspect.inspected}
          onClick={() => onInspectSignal("link")}
        />
      </div>
      <div className="space-y-3">
        {state.inspectedSignals.includes("sender") ? (
          <InspectionResult title={scenario.senderInspectionTitle} body={scenario.senderInspectionBody} />
        ) : null}
        {state.inspectedSignals.includes("link") ? (
          <InspectionResult title={scenario.linkInspectionTitle} body={scenario.linkInspectionBody} />
        ) : null}
      </div>
      <AnalystNote>{note}</AnalystNote>
      <PanelAction
        disabled={state.inspectedSignals.length === 0}
        onClick={() => dispatch({ type: "continue_inspect" })}
      >
        {simulation.inspect.continue}
      </PanelAction>
    </PanelFrame>
  );
}

function RetryPanel({
  state,
  scenario,
  simulation,
  onInspectSignal,
  onSelectDecision,
}: {
  state: SimulationState;
  scenario: ScenarioCopy;
  simulation: SimulationMessages;
  onInspectSignal: (signal: "sender" | "link") => void;
  onSelectDecision: (decision: Decision) => void;
}) {
  const hasSender = state.retryInspectedSignals.includes("sender");
  const hasLink = state.retryInspectedSignals.includes("link");
  const canChoose = state.retryInspectedSignals.length > 0;
  const note = canChoose ? simulation.retryStep.analystNote : simulation.retryStep.choiceRequirement;

  return (
    <PanelFrame stage="retry" title={simulation.retryStep.title} simulation={simulation}>
      <p className="leading-7 text-muted">{simulation.retryStep.description}</p>
      <p className="font-mono text-[11px] tracking-[0.08em] text-ice">{simulation.retryStep.inspectPrompt}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <InspectionButton
          inspected={hasSender}
          label={simulation.inspect.senderAction}
          status={simulation.inspect.inspected}
          onClick={() => onInspectSignal("sender")}
        />
        <InspectionButton
          inspected={hasLink}
          label={simulation.inspect.linkAction}
          status={simulation.inspect.inspected}
          onClick={() => onInspectSignal("link")}
        />
      </div>
      <div className="space-y-3">
        {hasSender ? <InspectionResult title={scenario.senderInspectionTitle} body={scenario.senderInspectionBody} /> : null}
        {hasLink ? <InspectionResult title={scenario.linkInspectionTitle} body={scenario.linkInspectionBody} /> : null}
      </div>
      <AnalystNote>{note}</AnalystNote>
      <div className="border-t border-white/[0.08] pt-5">
        <p className="font-mono text-[11px] tracking-[0.08em] text-ice">{simulation.retryStep.question}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{simulation.retryStep.helper}</p>
        <div className="mt-4">
          <DecisionChoices
            choices={simulation.decide.choices}
            disabled={!canChoose}
            onSelect={onSelectDecision}
          />
        </div>
      </div>
    </PanelFrame>
  );
}

function PanelFrame({
  children,
  stage,
  title,
  simulation,
}: {
  children: React.ReactNode;
  stage: Exclude<SimulationStage, "briefing" | "reveal" | "complete">;
  title: string;
  simulation: SimulationMessages;
}) {
  return (
    <section className="border border-white/[0.08] bg-navy-900/70 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted">{simulation.analystLabel}</p>
        <span className="font-mono text-[10px] tracking-[0.14em] text-signal">{simulation.stageLabels[stage]}</span>
      </div>
      <h2 className="mt-8 text-2xl font-semibold tracking-tight text-ice sm:text-3xl">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function AnalystNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-signal/50 bg-navy-950/60 p-4">
      <p className="font-mono text-[11px] leading-5 text-muted">{children}</p>
    </div>
  );
}

function PanelAction({ children, disabled = false, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center self-start border border-signal bg-signal px-5 font-mono text-xs font-bold tracking-[0.1em] text-navy-950 transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:border-navy-700 disabled:bg-navy-800 disabled:text-muted"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
      <span aria-hidden="true" className="ml-4 text-base">→</span>
    </button>
  );
}

function InspectionButton({ inspected, label, status, onClick }: { inspected: boolean; label: string; status: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={inspected}
      className="flex min-h-14 items-center gap-3 border border-white/[0.1] bg-navy-950/60 px-4 text-left transition hover:border-signal/50 disabled:cursor-default disabled:border-signal/40"
      disabled={inspected}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-xs ${inspected ? "border-signal bg-signal/10 text-signal" : "border-navy-700 text-muted"}`}>
        {inspected ? "✓" : "?"}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs text-ice">{inspected ? status : label}</span>
        <span className="mt-1 block font-mono text-[10px] text-muted">{inspected ? status : ""}</span>
      </span>
    </button>
  );
}

function InspectionResult({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-navy-700 bg-navy-950/60 p-4">
      <p className="font-mono text-xs text-signal">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
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
    <div className="grid gap-3">
      {decisionOptions.map((option) => {
        const choice = choices[option.choiceKey];

        return (
          <button
            key={option.decision}
            className="flex min-h-16 items-center gap-4 border border-white/[0.1] bg-navy-950/60 px-4 py-3 text-left transition hover:border-signal/60 hover:bg-navy-850 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={disabled}
            type="button"
            onClick={() => onSelect(option.decision)}
          >
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center border border-navy-700 font-mono text-sm text-ice">
              {option.marker}
            </span>
            <span>
              <span className="block font-mono text-xs text-ice">{choice.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{choice.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AttackerConsole({
  decision,
  simulation,
  onRetry,
}: {
  decision: Decision;
  simulation: SimulationMessages;
  onRetry: () => void;
}) {
  const [visibleTraceCount, setVisibleTraceCount] = useState(0);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const isUnsafe = decision === "open_link";
  const consoleCopy = simulation.console;
  const reveal = simulation.reveal;
  const feedback = isUnsafe ? reveal.unsafeFeedback : reveal.safeFeedback;
  const trace = isUnsafe
    ? consoleCopy.traceUnsafe
    : decision === "report_delete"
      ? consoleCopy.traceReport
      : consoleCopy.traceSafe;
  const choice = simulation.decide.choices[choiceKeyByDecision[decision]];
  const traceFinished = visibleTraceCount >= trace.length;

  useEffect(() => {
    setVisibleTraceCount(0);
    setAnalysisExpanded(false);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleTraceCount(trace.length);
      return;
    }

    const timer = window.setInterval(() => {
      setVisibleTraceCount((currentCount) => {
        if (currentCount >= trace.length) {
          window.clearInterval(timer);
          return currentCount;
        }

        return currentCount + 1;
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [decision, trace.length]);

  return (
    <div className="space-y-3">
      <section className={`overflow-hidden border-2 bg-navy-900 shadow-panel ${isUnsafe ? "border-warning/45" : "border-signal/45"}`}>
        <div className="border-b border-white/[0.08] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${isUnsafe ? "bg-warning" : "bg-signal"}`} />
              <p className="font-mono text-[11px] font-bold tracking-[0.16em] text-ice">{consoleCopy.title}</p>
            </div>
            <span className="font-mono text-[10px] tracking-[0.14em] text-muted">{simulation.stageLabels.reveal}</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border border-white/[0.08] bg-navy-950/60 p-3">
              <p className="font-mono text-[9px] tracking-[0.12em] text-muted">{consoleCopy.targetSession}</p>
              <p className="mt-2 font-mono text-xs text-signal">{consoleCopy.targetValue}</p>
            </div>
            <div className="border border-white/[0.08] bg-navy-950/60 p-3">
              <p className="font-mono text-[9px] tracking-[0.12em] text-muted">{consoleCopy.decisionLabel}</p>
              <p className="mt-2 font-mono text-xs text-ice">{choice.label}</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] tracking-[0.16em] text-signal">{consoleCopy.traceLabel}</p>
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted">{simulation.safeNote}</span>
          </div>

          <div className="mt-5 min-h-[15rem] border border-white/[0.08] bg-navy-950/70 p-4 sm:p-5">
            {visibleTraceCount === 0 ? (
              <p className="font-mono text-xs text-muted" aria-live="polite">{consoleCopy.traceWaiting}</p>
            ) : (
              <ol className="space-y-3" aria-live="polite">
                {trace.slice(0, visibleTraceCount).map((event, index) => (
                  <li key={event} className="flex items-start gap-3 border-l border-signal/50 pl-4">
                    <span aria-hidden="true" className="font-mono text-[10px] text-signal">{String(index + 1).padStart(2, "0")}</span>
                    <span className="font-mono text-xs leading-6 text-ice">{event}</span>
                  </li>
                ))}
              </ol>
            )}
            {!traceFinished ? <p className="mt-6 font-mono text-[10px] tracking-[0.1em] text-muted" aria-live="polite">{consoleCopy.traceRunning}</p> : null}
          </div>

          {traceFinished ? (
            <div className={`mt-5 flex flex-wrap items-start justify-between gap-4 border p-4 ${isUnsafe ? "border-warning/40 bg-warning/[0.04]" : "border-signal/40 bg-signal/[0.04]"}`}>
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{consoleCopy.finalStatus}</p>
                <p className={`mt-2 font-mono text-sm font-bold tracking-[0.1em] ${isUnsafe ? "text-warning" : "text-signal"}`}>
                  {isUnsafe ? consoleCopy.unsafeStatus : consoleCopy.safeStatus}
                </p>
                <p className="mt-2 max-w-md text-xs leading-5 text-muted">{isUnsafe ? consoleCopy.unsafeStatusDetail : consoleCopy.safeStatusDetail}</p>
              </div>
            </div>
          ) : null}
        </div>

        {traceFinished ? (
          <div className="border-t border-white/[0.08] bg-navy-950/75 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.12em] text-signal">{reveal.notificationLabel}</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ice">{feedback.whatHappened}</p>
            </div>
            <button
              aria-controls="attacker-analysis"
              aria-expanded={analysisExpanded}
              className="mt-4 inline-flex min-h-10 shrink-0 items-center border border-signal px-4 font-mono text-[11px] tracking-[0.08em] text-signal transition hover:bg-signal hover:text-navy-950 sm:mt-0"
              type="button"
              onClick={() => setAnalysisExpanded((expanded) => !expanded)}
            >
              {analysisExpanded ? reveal.hideAnalysis : reveal.viewAnalysis}
              <span aria-hidden="true" className="ml-3">{analysisExpanded ? "↑" : "↓"}</span>
            </button>
          </div>
        ) : null}
      </section>

      {traceFinished && analysisExpanded ? (
        <AnalysisSheet feedback={feedback} simulation={simulation} onClose={() => setAnalysisExpanded(false)} />
      ) : null}

      {traceFinished ? (
        <div className="flex justify-end">
          <button
            className="font-mono text-[10px] tracking-[0.08em] text-muted hover:text-ice"
            type="button"
            onClick={onRetry}
          >
            {reveal.retry} <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] sm:gap-4">
      <dt className="font-mono text-[10px] tracking-[0.1em] text-muted">{label}</dt>
      <dd className="text-sm leading-6 text-ice">{value}</dd>
    </div>
  );
}

function AnalysisSheet({
  feedback,
  simulation,
  onClose,
}: {
  feedback: SimulationMessages["reveal"]["unsafeFeedback"];
  simulation: SimulationMessages;
  onClose: () => void;
}) {
  return (
    <section id="attacker-analysis" aria-labelledby="attacker-analysis-title" className="border border-signal/30 bg-navy-950 shadow-panel">
      <div className="flex justify-center py-3 md:hidden">
        <span aria-hidden="true" className="h-1 w-12 rounded-full bg-muted/60" />
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-6">
        <h3 id="attacker-analysis-title" className="font-mono text-[11px] tracking-[0.16em] text-signal">{simulation.reveal.analysisTitle}</h3>
        <button className="font-mono text-[10px] tracking-[0.08em] text-muted hover:text-ice" type="button" onClick={onClose}>
          {simulation.reveal.hideAnalysis}
        </button>
      </div>
      <dl className="space-y-4 px-5 py-5 sm:px-6">
        <FeedbackRow label={simulation.reveal.fields.signal} value={feedback.signal} />
        <FeedbackRow label={simulation.reveal.fields.technique} value={feedback.technique} />
        <FeedbackRow label={simulation.reveal.fields.impact} value={feedback.impact} />
        <FeedbackRow label={simulation.reveal.fields.saferResponse} value={feedback.saferResponse} />
      </dl>
    </section>
  );
}

function TrustedChannelSheet({ simulation, onConfirm }: { simulation: SimulationMessages; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/85 p-4 sm:items-center">
      <section
        aria-describedby="trusted-channel-description"
        aria-labelledby="trusted-channel-title"
        aria-modal="true"
        className="w-full max-w-lg border border-signal/40 bg-navy-900 p-6 shadow-panel sm:p-8"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center border border-signal/50 bg-signal/10 font-mono text-signal">✓</span>
          <div>
            <h2 id="trusted-channel-title" className="font-mono text-sm font-bold tracking-[0.08em] text-ice">{simulation.verify.sheetTitle}</h2>
            <p id="trusted-channel-description" className="mt-3 text-sm leading-6 text-muted">{simulation.verify.sheetDescription}</p>
          </div>
        </div>
        <div className="mt-6 border border-signal/25 bg-signal/[0.04] p-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{simulation.verify.orderLabel}</p>
          <p className="mt-4 text-lg font-medium text-signal">{simulation.verify.orderStatus}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{simulation.verify.orderStatusDescription}</p>
        </div>
        <button
          className="mt-6 inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-mono text-xs font-bold tracking-[0.1em] text-navy-950 transition hover:bg-signal/90"
          type="button"
          onClick={onConfirm}
        >
          {simulation.verify.continue}
          <span aria-hidden="true" className="ml-4 text-base">→</span>
        </button>
      </section>
    </div>
  );
}

function CompletionPanel({ progress, simulation }: { progress: PracticeProgress | null; simulation: SimulationMessages }) {
  const messages = getMessages();
  const mastery = progress
    ? `${simulation.complete.masteryLabel}: ${messages.progress.masteryStates[progress.mastery]}`
    : simulation.complete.mastery;

  return (
    <section className="mt-8 border border-signal/40 bg-navy-900 p-6 shadow-panel sm:p-10">
      <div className="flex h-12 w-12 items-center justify-center border border-signal bg-signal/10 font-mono text-xl text-signal">✓</div>
      <div className="mt-10 max-w-2xl">
        <p className="font-mono text-[11px] tracking-[0.2em] text-signal">{simulation.stageLabels.complete}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{simulation.complete.title}</h2>
        <p className="mt-4 leading-7 text-muted">{simulation.complete.description}</p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="border border-white/[0.08] bg-navy-950/50 p-5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted">{simulation.complete.skillUpdate}</p>
          <p className="mt-4 font-mono text-sm text-signal">{mastery}</p>
        </div>
        <p className="border border-white/[0.08] bg-navy-950/50 p-5 text-sm leading-6 text-muted">{simulation.complete.support}</p>
      </div>
      <Link className="mt-8 inline-flex min-h-11 items-center border border-signal px-5 font-mono text-xs tracking-[0.1em] text-signal transition hover:bg-signal hover:text-navy-950" href="/">
        {simulation.complete.backHome}
        <span aria-hidden="true" className="ml-4 text-base">→</span>
      </Link>
    </section>
  );
}
