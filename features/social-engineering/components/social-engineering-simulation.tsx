"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordModuleCompletion } from "@/features/progress/progress";
import {
  persistPracticeEvent,
  persistProgressSnapshot,
  startPracticeAttempt,
  type PracticeAttemptResult,
  type PracticeEventMetadata,
  type PracticeEventType,
  type RemoteSyncResult,
} from "@/features/progress/supabase-persistence";
import { getMessages, type Messages } from "@/lib/i18n";
import { marketplaceScenarios, type MarketplaceScenarioCopy } from "../scenario-data";
import { initialSocialEngineeringState, socialEngineeringReducer, type SocialEngineeringState } from "../simulation-machine";
import { type SocialEngineeringDecision, type SocialEngineeringStage } from "../types";

type SocialMessages = Messages["socialEngineering"];
type Scenario = SocialMessages["scenarios"][MarketplaceScenarioCopy];
type Feedback = SocialMessages["reveal"]["safe"];
const checkpoints = ["context", "trust", "channel", "pressure", "decide"] as const;
const checkpointIndex: Record<SocialEngineeringStage, number> = { briefing: 0, context: 0, trust: 1, channel_shift: 2, pressure: 3, decide: 4, reveal: 4, retry: 4, complete: 4 };
const persistenceStage: Record<SocialEngineeringStage, string> = { briefing: "briefing", context: "receive", trust: "inspect", channel_shift: "inspect", pressure: "verify", decide: "decide", reveal: "reveal", retry: "retry", complete: "complete" };
const decisionOptions: ReadonlyArray<{ decision: SocialEngineeringDecision; key: "comply" | "verify" | "report"; marker: string }> = [
  { decision: "comply_with_request", key: "comply", marker: "↗" },
  { decision: "verify_independently", key: "verify", marker: "✓" },
  { decision: "report_offer", key: "report", marker: "×" },
];

export function SocialEngineeringSimulation() {
  const messages = getMessages();
  const social = messages.socialEngineering;
  const [state, dispatch] = useReducer(socialEngineeringReducer, initialSocialEngineeringState);
  const completionRecorded = useRef(false);
  const hasStartedRef = useRef(false);
  const attemptIdRef = useRef<string | null>(null);
  const attemptPromiseRef = useRef<Promise<PracticeAttemptResult> | null>(null);
  const recordedEventKeysRef = useRef(new Set<string>());
  const [syncStatus, setSyncStatus] = useState<RemoteSyncResult["status"] | null>(null);
  const isRetryRound = state.stage === "retry" || state.retryDecision !== null || state.stage === "complete";
  const scenario = social.scenarios[(isRetryRound ? marketplaceScenarios.retry : marketplaceScenarios.primary).copyKey];
  const activeDecision = state.stage === "reveal" || state.stage === "complete" ? state.retryDecision ?? state.decision : null;

  const ensureAttempt = useCallback(() => {
    if (attemptPromiseRef.current) return attemptPromiseRef.current;
    const attemptPromise = startPracticeAttempt("social-engineering").then((result) => {
      attemptIdRef.current = result.attemptId;
      return result;
    }).catch(() => ({ attemptId: null, status: "local_only" as const, reason: "remote_error" as const }));
    attemptPromiseRef.current = attemptPromise;
    return attemptPromise;
  }, []);

  const recordEvent = useCallback((key: string, eventType: PracticeEventType, stage: SocialEngineeringStage, metadata?: PracticeEventMetadata) => {
    if (recordedEventKeysRef.current.has(key)) return;
    recordedEventKeysRef.current.add(key);
    void ensureAttempt().then(({ attemptId }) => persistPracticeEvent({ attemptId, eventType, stage: persistenceStage[stage], metadata })).catch(() => undefined);
  }, [ensureAttempt]);

  useEffect(() => {
    if (hasStartedRef.current && state.stage !== "briefing") recordEvent(`stage:${state.stage}:${state.retryDecision ?? "primary"}`, "stage_viewed", state.stage);
  }, [recordEvent, state.retryDecision, state.stage]);

  useEffect(() => {
    if (state.stage !== "complete" || state.retryDecision === null || completionRecorded.current) return;
    completionRecorded.current = true;
    const finalDecision = state.retryDecision;
    const outcome = finalDecision === "comply_with_request" ? "unsafe" : "safe";
    recordEvent("module_completed", "module_completed", "complete", { outcome });
    const nextProgress = recordModuleCompletion({
      moduleId: "social-engineering",
      outcome,
      habits: {
        inspect: state.primarySignals.length > 0 || state.retrySignals.length > 0,
        verify: finalDecision === "verify_independently" || finalDecision === "stay_on_platform",
        report: finalDecision === "report_offer",
      },
    });
    void ensureAttempt().then(({ attemptId }) => {
      if (!attemptId) { setSyncStatus("local_only"); return null; }
      return persistProgressSnapshot({ progress: nextProgress, moduleId: "social-engineering", attemptId });
    }).then((result) => { if (result) setSyncStatus(result.status); }).catch(() => setSyncStatus("local_only"));
  }, [ensureAttempt, recordEvent, state.primarySignals.length, state.retryDecision, state.retrySignals.length, state.stage]);

  const startModule = () => { hasStartedRef.current = true; recordEvent("module_started", "module_started", "briefing"); dispatch({ type: "start_module" }); };
  const selectDecision = (decision: SocialEngineeringDecision) => {
    const retry = state.stage === "retry";
    recordEvent(`decision:${retry ? "retry" : "primary"}`, "decision_selected", retry ? "retry" : "decide", { choice: decision });
    dispatch(retry ? { type: "select_retry_decision", decision } : { type: "select_decision", decision });
  };
  const inspectRetry = (signal: "seller" | "payment") => { recordEvent(`retry-inspect:${signal}`, signal === "seller" ? "sender_inspected" : "link_inspected", "retry", { signal }); dispatch({ type: "inspect_retry", signal }); };
  const advanceOutcome = () => {
    if (state.retryDecision) { dispatch({ type: "complete_module" }); return; }
    recordEvent("retry_started", "retry_started", "reveal", { variant: "retry" });
    dispatch({ type: "start_retry" });
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl"><p className="font-mono text-xs tracking-[0.1em] text-signal">{social.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ice sm:text-4xl">{social.title}</h1><p className="mt-3 text-sm leading-6 text-muted sm:text-base">{social.description}</p></div>
        <p className="border border-signal/30 px-3 py-2 font-mono text-xs text-signal">{social.safeNote}</p>
      </header>
      <ProgressRail activeStage={state.stage} social={social} />
      {state.stage === "briefing" ? <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6"><span className="font-mono text-xs text-muted">{social.briefing.checkpointCount}</span><ActionButton onClick={startModule}>{social.briefing.begin}</ActionButton></section> : (
        <div className="relative mt-7 grid gap-7 lg:grid-cols-2 lg:gap-12">
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 hidden h-px w-12 -translate-x-1/2 bg-signal/30 lg:block" />
          <MarketplaceVictim activeDecision={activeDecision} isRetryRound={isRetryRound} onInspectRetry={inspectRetry} onSelectDecision={selectDecision} scenario={scenario} social={social} state={state} dispatch={dispatch} />
          <MarketplaceAttacker activeDecision={activeDecision} isRetryRound={isRetryRound} onAdvance={advanceOutcome} social={social} state={state} />
        </div>
      )}
      {state.stage === "complete" ? <section className="mx-auto mt-7 flex max-w-[52rem] flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5"><div><p className="font-mono text-xs text-signal">{social.complete.title}</p><p className="mt-1 text-sm leading-6 text-muted">{social.complete.description}</p>{syncStatus === "local_only" ? <p className="mt-2 font-mono text-[11px] text-warning" role="status">{messages.progress.syncPending}</p> : null}</div><Link className="font-mono text-xs text-signal" href="/">{social.complete.backHome} →</Link></section> : null}
    </div>
  );
}

function ProgressRail({ activeStage, social }: { activeStage: SocialEngineeringStage; social: SocialMessages }) {
  const activeIndex = checkpointIndex[activeStage];
  return <ol className="mt-7 grid grid-cols-5 border-y border-white/[0.08]" aria-label={social.flowLabel}>{checkpoints.map((checkpoint, index) => <li key={checkpoint} className={`min-w-0 border-b-2 px-2 py-3 font-mono text-[11px] leading-4 sm:px-3 ${index === activeIndex ? "border-signal text-signal" : index < activeIndex ? "border-ice/50 text-ice" : "border-transparent text-muted"}`}><span className="hidden sm:inline">{index < activeIndex ? "✓ " : `${index + 1} `}</span>{social.checkpoints[checkpoint]}</li>)}</ol>;
}

function MarketplaceVictim({ activeDecision, isRetryRound, onInspectRetry, onSelectDecision, scenario, social, state, dispatch }: {
  activeDecision: SocialEngineeringDecision | null;
  isRetryRound: boolean;
  onInspectRetry: (signal: "seller" | "payment") => void;
  onSelectDecision: (decision: SocialEngineeringDecision) => void;
  scenario: Scenario;
  social: SocialMessages;
  state: SocialEngineeringState;
  dispatch: React.Dispatch<Parameters<typeof socialEngineeringReducer>[1]>;
}) {
  const isOutcome = state.stage === "reveal" || state.stage === "complete";
  const retrySignals = state.retrySignals;

  return <section className="mx-auto w-full max-w-[25rem]" aria-label={social.devices.victim}><p className="mb-3 font-mono text-xs tracking-[0.1em] text-muted">{social.devices.victim}</p><div className="rounded-[2.2rem] border-[7px] border-navy-700 bg-navy-950 p-2 shadow-panel"><div className="min-h-[39rem] overflow-hidden rounded-[1.65rem] border border-white/[0.08] bg-navy-950"><MarketplaceHeader scenario={scenario} /><div className="min-h-[24rem] space-y-4 bg-navy-900/40 px-4 py-5">{isOutcome && activeDecision ? <VictimOutcome decision={activeDecision} social={social} /> : <><Listing scenario={scenario} /><Conversation scenario={scenario} stage={state.stage} /></>}</div>{!isOutcome ? <div className="border-t border-white/[0.08] bg-navy-950 p-4"><VictimControls isRetryRound={isRetryRound} onInspectRetry={onInspectRetry} onSelectDecision={onSelectDecision} scenario={scenario} social={social} state={state} dispatch={dispatch} retrySignals={retrySignals} /></div> : null}</div></div></section>;
}

function MarketplaceHeader({ scenario }: { scenario: Scenario }) {
  return <><div className="flex justify-center pt-2"><span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-navy-700" /></div><div className="flex items-center justify-between px-4 py-3 font-mono text-[10px] text-muted"><span>10:12</span><span className="text-signal">MARKETPLACE</span></div><div className="border-y border-white/[0.08] px-4 py-3"><p className="font-mono text-xs text-ice">{scenario.seller}</p><p className="mt-1 font-mono text-[10px] text-muted">{scenario.handle} · {scenario.rating}</p></div></>;
}

function Listing({ scenario }: { scenario: Scenario }) {
  return <article className="border border-navy-700 bg-navy-950 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] text-signal">LISTING</p><h2 className="mt-2 text-base font-semibold text-ice">{scenario.listing}</h2></div><p className="font-mono text-sm text-warning">{scenario.price}</p></div><p className="mt-4 border-l-2 border-white/[0.16] pl-3 text-xs leading-5 text-muted">{scenario.review}</p></article>;
}

function Conversation({ scenario, stage }: { scenario: Scenario; stage: SocialEngineeringStage }) {
  const showChannel = ["channel_shift", "pressure", "decide", "reveal", "retry", "complete"].includes(stage);
  const showHandler = ["pressure", "decide", "reveal", "retry", "complete"].includes(stage);
  return <div className="space-y-3"><div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-navy-700 bg-navy-850 p-3 text-sm leading-5 text-ice">{scenario.opening}</div>{showChannel ? <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-warning/30 bg-navy-950 p-3 text-xs leading-5 text-ice">{scenario.channelRequest}</div> : null}{showHandler ? <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm border border-warning/30 bg-warning/[0.05] p-3 text-xs leading-5 text-ice"><p className="font-mono text-[10px] text-warning">{scenario.handler}</p><p className="mt-2">{scenario.request}</p></div> : null}</div>;
}

function VictimControls({ isRetryRound, onInspectRetry, onSelectDecision, scenario, social, state, dispatch, retrySignals }: {
  isRetryRound: boolean;
  onInspectRetry: (signal: "seller" | "payment") => void;
  onSelectDecision: (decision: SocialEngineeringDecision) => void;
  scenario: Scenario;
  social: SocialMessages;
  state: SocialEngineeringState;
  dispatch: React.Dispatch<Parameters<typeof socialEngineeringReducer>[1]>;
  retrySignals: readonly ("seller" | "payment")[];
}) {
  if (isRetryRound && state.stage === "retry") return <div className="space-y-3"><p className="font-mono text-xs text-ice">{social.retry.prompt}</p><div className="grid gap-2 sm:grid-cols-2"><InspectButton active={retrySignals.includes("seller")} label={social.trust.inspect} onClick={() => onInspectRetry("seller")} /><InspectButton active={retrySignals.includes("payment")} label={social.pressure.inspect} onClick={() => onInspectRetry("payment")} /></div>{retrySignals.includes("seller") ? <Detail body={scenario.sellerInspection} /> : null}{retrySignals.includes("payment") ? <Detail body={scenario.paymentInspection} /> : null}<p className="font-mono text-xs text-ice">{social.retry.question}</p><DecisionChoices disabled={retrySignals.length === 0} onSelect={onSelectDecision} social={social} /></div>;
  if (state.stage === "context") return <div className="space-y-3"><p className="text-xs leading-5 text-muted">{social.context.note}</p><ActionButton onClick={() => dispatch({ type: "continue_context" })}>{social.context.action}</ActionButton></div>;
  if (state.stage === "trust") return <div className="space-y-3"><p className="font-mono text-xs text-ice">{social.trust.title}</p><InspectButton active={state.primarySignals.includes("seller")} label={social.trust.inspect} onClick={() => dispatch({ type: "inspect_seller" })} />{state.primarySignals.includes("seller") ? <Detail body={scenario.sellerInspection} /> : null}<p className="text-xs leading-5 text-muted">{social.trust.note}</p><div className="flex flex-wrap gap-2"><ActionButton onClick={() => dispatch({ type: "continue_trust" })}>{social.trust.continue}</ActionButton><QuietAction onClick={() => dispatch({ type: "stay_on_platform" })}>{social.trust.stay}</QuietAction></div></div>;
  if (state.stage === "channel_shift") return <div className="space-y-3"><p className="font-mono text-xs text-ice">{social.channel.title}</p><p className="text-xs leading-5 text-muted">{social.channel.note}</p><div className="flex flex-wrap gap-2"><ActionButton onClick={() => dispatch({ type: "accept_channel_shift" })}>{social.channel.accept}</ActionButton><QuietAction onClick={() => dispatch({ type: "stay_on_platform" })}>{social.channel.stay}</QuietAction></div></div>;
  if (state.stage === "pressure") return <div className="space-y-3"><p className="font-mono text-xs text-ice">{social.pressure.title}</p><InspectButton active={state.primarySignals.includes("payment")} label={social.pressure.inspect} onClick={() => dispatch({ type: "inspect_payment" })} />{state.primarySignals.includes("payment") ? <Detail body={scenario.paymentInspection} /> : null}<p className="text-xs leading-5 text-muted">{social.pressure.note}</p><ActionButton onClick={() => dispatch({ type: "continue_pressure" })}>{social.pressure.continue}</ActionButton></div>;
  if (state.stage === "decide") return <DecisionChoices onSelect={onSelectDecision} social={social} />;
  return null;
}

function Detail({ body }: { body: string }) { return <p className="border-l-2 border-warning/50 pl-3 text-xs leading-5 text-muted">{body}</p>; }
function InspectButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`min-h-11 border px-3 py-2 text-left font-mono text-xs ${active ? "border-signal/50 text-signal" : "border-white/[0.1] text-ice hover:border-signal/50"}`} disabled={active} type="button" onClick={onClick}>{active ? "✓ " : ""}{label}</button>; }
function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button className="min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950" type="button" onClick={onClick}>{children} <span aria-hidden="true" className="ml-2">→</span></button>; }
function QuietAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button className="min-h-11 border border-white/[0.14] px-4 font-mono text-xs text-ice hover:border-signal/50" type="button" onClick={onClick}>{children}</button>; }

function DecisionChoices({ disabled = false, onSelect, social }: { disabled?: boolean; onSelect: (decision: SocialEngineeringDecision) => void; social: SocialMessages }) { return <div className="grid gap-2">{decisionOptions.map((option) => { const choice = social.decide.choices[option.key]; return <button key={option.decision} className="flex min-h-12 items-center gap-3 border border-white/[0.1] bg-navy-900 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45" disabled={disabled} type="button" onClick={() => onSelect(option.decision)}><span aria-hidden="true" className="font-mono text-sm text-signal">{option.marker}</span><span><span className="block font-mono text-xs text-ice">{choice.label}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{choice.description}</span></span></button>; })}</div>; }

function VictimOutcome({ decision, social }: { decision: SocialEngineeringDecision; social: SocialMessages }) { const detail = decision === "comply_with_request" ? social.outcomes.complied : decision === "report_offer" ? social.outcomes.reported : social.outcomes.verified; return <div className="rounded-xl border border-warning/30 bg-navy-950 p-5"><p className="font-mono text-xs text-warning">SIMULASI · TIDAK ADA TRANSAKSI NYATA</p><p className="mt-5 text-sm leading-6 text-ice">{detail}</p></div>; }

function MarketplaceAttacker({ activeDecision, isRetryRound, onAdvance, social, state }: { activeDecision: SocialEngineeringDecision | null; isRetryRound: boolean; onAdvance: () => void; social: SocialMessages; state: SocialEngineeringState }) {
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const events = timelineFor(state, social, isRetryRound, activeDecision);
  const feedback = activeDecision === "comply_with_request" ? social.reveal.unsafe : social.reveal.safe;
  const status = activeDecision ? (activeDecision === "comply_with_request" ? social.console.statusImpact : social.console.statusInterrupted) : statusFor(state, social, isRetryRound);
  const control = activeDecision ? (activeDecision === "comply_with_request" ? social.console.controlHigh : social.console.controlLost) : controlFor(state, social, isRetryRound);
  return <section className="mx-auto w-full max-w-[25rem]" aria-label={social.devices.attacker}><p className="mb-3 font-mono text-xs tracking-[0.1em] text-muted">{social.devices.attacker}</p><div className="rounded-[2.2rem] border-[7px] border-[#101922] bg-[#05090d] p-2 shadow-panel"><div className="min-h-[39rem] overflow-hidden rounded-[1.65rem] border border-white/[0.08] bg-[#070d13]"><div className="flex justify-center pt-2"><span aria-hidden="true" className="h-1.5 w-16 rounded-full bg-navy-700" /></div><div className="border-b border-white/[0.08] px-4 pb-4 pt-5"><div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-bold tracking-[0.08em] text-ice">{social.console.campaign}</p><span className="font-mono text-[10px] text-signal">{isRetryRound ? social.console.roundRetry : social.console.roundPrimary}</span></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[10px] leading-4"><ConsoleField label={social.console.campaignLabel} value="MKT-02" /><ConsoleField label={social.console.targetLabel} value={social.console.targetValue} /><ConsoleField label={social.console.objectiveLabel} value={social.console.objective} wide /><ConsoleField label={social.console.tacticLabel} value={isRetryRound ? social.console.retryTactic : social.console.tactic} wide /></dl></div><div className="px-4 py-5"><div className="flex items-center justify-between"><p className="font-mono text-[10px] text-muted">{social.console.timelineLabel}</p><span className="font-mono text-[10px] text-warning">{status}</span></div><ol className="mt-4 min-h-[16rem] space-y-2 border-l border-white/[0.12] pl-3" aria-live="polite">{events.map((event, index) => <li key={`${event}-${index}`} className="font-mono text-[11px] leading-5 text-ice"><span className="mr-2 text-muted">[{eventTime(index)}]</span>{event}</li>)}</ol><div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3"><ConsoleField label={social.console.controlLabel} value={control} /><ConsoleField label={social.console.nextLabel} value={nextMoveFor(state, social, isRetryRound, activeDecision)} /></div></div>{activeDecision ? <div className="border-t border-white/[0.08] bg-navy-950/90"><div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" /><div className="flex items-start justify-between gap-4 px-4 pb-4 pt-3"><div><p className="font-mono text-[10px] text-signal">{social.reveal.notification}</p><p className="mt-1 text-xs leading-5 text-ice">{feedback.whatHappened}</p></div><button aria-expanded={analysisExpanded} className="shrink-0 font-mono text-xs text-signal" type="button" onClick={() => setAnalysisExpanded((open) => !open)}>{analysisExpanded ? social.reveal.hide : social.reveal.view}</button></div>{analysisExpanded ? <AnalysisDrawer feedback={feedback} social={social} /> : null}</div> : null}{activeDecision && state.stage !== "complete" ? <div className="border-t border-white/[0.08] px-4 py-4"><button className="font-mono text-xs text-muted hover:text-ice" type="button" onClick={onAdvance}>{isRetryRound ? social.reveal.finish : social.reveal.retry} →</button></div> : null}</div></div></section>;
}

function ConsoleField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "col-span-2" : ""}><dt className="text-muted">{label}</dt><dd className="mt-1 text-ice">{value}</dd></div>; }
function AnalysisDrawer({ feedback, social }: { feedback: Feedback; social: SocialMessages }) { return <dl className="border-t border-white/[0.08] px-4 py-4"><AnalysisRow label={social.reveal.fields.whatHappened} value={feedback.whatHappened} /><AnalysisRow label={social.reveal.fields.attackerObjective} value={feedback.attackerObjective} /><AnalysisRow label={social.reveal.fields.technique} value={feedback.technique} /><AnalysisRow label={social.reveal.fields.saferResponse} value={feedback.saferResponse} /></dl>; }
function AnalysisRow({ label, value }: { label: string; value: string }) { return <div className="py-2 first:pt-0 last:pb-0"><dt className="font-mono text-[10px] text-muted">{label}</dt><dd className="mt-1 text-xs leading-5 text-ice">{value}</dd></div>; }

function timelineFor(state: SocialEngineeringState, social: SocialMessages, isRetryRound: boolean, decision: SocialEngineeringDecision | null): string[] { const events = isRetryRound ? [...social.console.retryEvents] : [...social.console.primaryEvents]; const signals = isRetryRound ? state.retrySignals : state.primarySignals; const reachedExternalHandler = !isRetryRound && (["pressure", "decide"].includes(state.stage) || ((state.stage === "reveal" || state.stage === "complete") && decision !== "stay_on_platform")); if (state.stage !== "context" || isRetryRound) events.push(social.console.opened); if (signals.includes("seller")) events.push(social.console.sellerChecked, social.console.trustQuestioned); if (reachedExternalHandler) events.push(social.console.channelAccepted, social.console.handlerIntroduced); if (!isRetryRound && signals.includes("payment")) events.push(social.console.paymentChecked, social.console.feeMismatch); if (decision === "comply_with_request") events.push(...social.console.complied); if (decision === "verify_independently" || decision === "stay_on_platform") events.push(social.console.platformRetained, social.console.verifyDetected, ...social.console.verified); if (decision === "report_offer") events.push(...social.console.reported); return events; }
function statusFor(state: SocialEngineeringState, social: SocialMessages, isRetryRound: boolean): string { if (isRetryRound) return social.console.statusEscalating; if (state.stage === "pressure" || state.stage === "decide") return social.console.statusEscalating; return social.console.statusActive; }
function controlFor(state: SocialEngineeringState, social: SocialMessages, isRetryRound: boolean): string { if (isRetryRound || state.primarySignals.length > 0) return social.console.controlReduced; return social.console.controlHigh; }
function nextMoveFor(state: SocialEngineeringState, social: SocialMessages, isRetryRound: boolean, decision: SocialEngineeringDecision | null): string { if (decision) return social.console.nextStopped; if (isRetryRound) return social.console.nextDecision; if (state.stage === "trust") return social.console.nextTrust; if (state.stage === "channel_shift") return social.console.nextChannel; if (state.stage === "pressure") return social.console.nextPressure; if (state.stage === "decide") return social.console.nextDecision; return social.console.nextContext; }
function eventTime(index: number): string { return `10:12:${String(8 + index * 2).padStart(2, "0")}`; }
