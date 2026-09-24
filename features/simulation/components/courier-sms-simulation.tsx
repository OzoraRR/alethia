"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordModuleCompletion, type PracticeProgress } from "@/features/progress/progress";
import { persistPracticeEvent, persistProgressSnapshot, startPracticeAttempt, type PracticeAttemptResult, type PracticeEventMetadata, type PracticeEventType, type RemoteSyncResult } from "@/features/progress/supabase-persistence";
import { getMessages, type Messages } from "@/lib/i18n";
import { initialSimulationState, simulationReducer, type SimulationState } from "../simulation-machine";
import type { Decision, SimulationStage } from "../types";

type Copy = Messages["simulation"]["redesign"];
type DecisionKey = keyof Copy["decide"]["options"];
type InspectionValues = { sender: string; link: string; tracking: string };

const decisions: Array<{ decision: Decision; key: DecisionKey }> = [
  { decision: "open_link", key: "openLink" },
  { decision: "official_channel", key: "official" },
  { decision: "ignore_message", key: "ignore" },
  { decision: "report_message", key: "report" },
  { decision: "reply_sender", key: "reply" },
];

const stageIndex: Record<SimulationStage, number> = {
  briefing: 0, receive: 0, inspect: 1, verify: 2, decide: 3, reveal: 4, retry: 3, complete: 4,
};

export function CourierSmsSimulation() {
  const copy = getMessages().simulation.redesign;
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionValues, setInspectionValues] = useState<InspectionValues>({ sender: "", link: "", tracking: "" });
  const [inspectionSubmitted, setInspectionSubmitted] = useState(false);
  const [verificationValue, setVerificationValue] = useState("");
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState<PracticeProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncResult["status"] | null>(null);
  const attempt = useRef<Promise<PracticeAttemptResult> | null>(null);
  const attemptId = useRef<string | null>(null);
  const recorded = useRef(new Set<string>());
  const completionRecorded = useRef(false);

  const ensureAttempt = useCallback(() => {
    if (!attempt.current) {
      attempt.current = startPracticeAttempt("courier-sms").then((result) => {
        attemptId.current = result.attemptId;
        return result;
      }).catch(() => ({ attemptId: null, status: "local_only" as const, reason: "remote_error" as const }));
    }
    return attempt.current;
  }, []);

  const recordEvent = useCallback((key: string, eventType: PracticeEventType, stage: SimulationStage, metadata?: PracticeEventMetadata) => {
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    void ensureAttempt().then(({ attemptId: id }) => persistPracticeEvent({ attemptId: id, eventType, stage, metadata })).catch(() => undefined);
  }, [ensureAttempt]);

  useEffect(() => {
    if (state.stage !== "briefing") recordEvent(`stage:${state.stage}`, "stage_viewed", state.stage);
  }, [recordEvent, state.stage]);

  const activeDecision = state.stage === "reveal" || state.stage === "complete" ? state.retryDecision ?? state.decision : null;

  useEffect(() => {
    if (!activeDecision || state.stage !== "reveal") return;
    recordEvent(`decision-view:${activeDecision}`, "attacker_pov_viewed", "reveal", { choice: activeDecision });
    recordEvent(`feedback:${activeDecision}`, "feedback_viewed", "reveal", { choice: activeDecision });
  }, [activeDecision, recordEvent, state.stage]);

  useEffect(() => {
    if (state.stage !== "complete" || !state.retryDecision || completionRecorded.current) return;
    completionRecorded.current = true;
    const outcome = isUnsafe(state.retryDecision) ? "unsafe" : "safe";
    const next = recordModuleCompletion({
      moduleId: "courier-sms",
      outcome,
      habits: { inspect: state.inspectionComplete, verify: state.verificationComplete, report: state.retryDecision === "report_message" },
    });
    setProgress(next);
    recordEvent("module-completed", "module_completed", "complete", { outcome });
    void ensureAttempt().then(({ attemptId: id }) => id ? persistProgressSnapshot({ progress: next, moduleId: "courier-sms", attemptId: id }) : { status: "local_only" as const })
      .then((result) => setSyncStatus(result.status)).catch(() => setSyncStatus("local_only"));
  }, [ensureAttempt, recordEvent, state.inspectionComplete, state.retryDecision, state.stage, state.verificationComplete]);

  const begin = () => {
    recordEvent("module-started", "module_started", "briefing");
    dispatch({ type: "start_module" });
  };
  const completeInspection = () => {
    recordEvent("sender-inspected", "sender_inspected", "inspect", { source: "manual_entry" });
    recordEvent("link-inspected", "link_inspected", "inspect", { source: "manual_entry" });
    setInspectionOpen(false);
    dispatch({ type: "complete_inspection" });
  };
  const checkVerification = () => {
    const matches = normalize(verificationValue) === normalize(copy.scenario.trackingNumber);
    setVerificationFeedback(matches ? copy.verify.result : copy.verify.sampleMismatch);
    if (matches) {
      recordEvent("official-channel", "official_channel_verified", "verify", { channel: "simulated_courier_portal" });
      dispatch({ type: "complete_verification" });
    }
  };
  const choose = (decision: Decision) => {
    const retry = state.stage === "retry";
    recordEvent(`decision:${retry ? "retry" : "primary"}`, "decision_selected", retry ? "retry" : "decide", { choice: decision });
    dispatch(retry ? { type: "select_retry_decision", decision } : { type: "select_decision", decision });
  };
  const tryAnother = () => {
    recordEvent("retry", "retry_started", "reveal", { mode: "same_evidence" });
    dispatch({ type: "start_retry" });
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl"><p className="font-mono text-xs tracking-[.12em] text-signal">{copy.label}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-muted">{copy.description}</p></div>
        <p className="border border-signal/30 px-3 py-2 font-mono text-[11px] text-signal">{copy.safeNote}</p>
      </header>
      <ProgressRail active={stageIndex[state.stage]} checkpoints={copy.checkpoints} />

      {state.stage === "briefing" ? <section className="mt-7 border-b border-white/[.08] pb-6"><ActionButton onClick={begin}>{copy.begin}</ActionButton></section> : (
        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-12">
          <VictimPhone copy={copy} inspectionOpen={inspectionOpen} inspectionSubmitted={inspectionSubmitted} inspectionValues={inspectionValues} onChoose={choose} onCloseInspection={() => setInspectionOpen(false)} onCompleteInspection={completeInspection} onInspectionChange={(field, value) => setInspectionValues((current) => ({ ...current, [field]: value }))} onInspectionSubmit={() => setInspectionSubmitted(true)} onOpenInspection={() => { setInspectionOpen(true); dispatch({ type: "open_inspection" }); }} onOpenVerification={() => dispatch({ type: "open_trusted_channel" })} onProceed={() => dispatch({ type: "continue_to_decision" })} onVerificationChange={setVerificationValue} onVerify={checkVerification} state={state} verificationFeedback={verificationFeedback} verificationValue={verificationValue} />
          <RouteAnalysis copy={copy} decision={activeDecision} state={state} />
        </div>
      )}

      {activeDecision && state.stage === "reveal" ? <div className="mt-6 flex flex-wrap gap-3">{state.retryDecision === null ? <ActionButton onClick={tryAnother}>{copy.analysis.tryAnother}</ActionButton> : <ActionButton onClick={() => dispatch({ type: "complete_module" })}>{copy.analysis.finish}</ActionButton>}</div> : null}
      {state.stage === "complete" ? <section className="mt-8 flex flex-wrap items-start justify-between gap-4 border-t border-white/[.08] pt-6"><div><p className="font-mono text-xs text-signal">{copy.complete.title}</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted">{copy.complete.description}</p>{progress ? <p className="mt-2 font-mono text-[11px] text-muted">{progress.modulesCompleted} {copy.complete.modules}</p> : null}{syncStatus === "local_only" ? <p className="mt-2 font-mono text-[11px] text-warning">{copy.complete.sync}</p> : null}</div><Link className="font-mono text-xs text-signal" href="/">{copy.complete.back} →</Link></section> : null}
    </main>
  );
}

function VictimPhone({ copy, inspectionOpen, inspectionSubmitted, inspectionValues, onChoose, onCloseInspection, onCompleteInspection, onInspectionChange, onInspectionSubmit, onOpenInspection, onOpenVerification, onProceed, onVerificationChange, onVerify, state, verificationFeedback, verificationValue }: {
  copy: Copy; inspectionOpen: boolean; inspectionSubmitted: boolean; inspectionValues: InspectionValues;
  onChoose: (decision: Decision) => void; onCloseInspection: () => void; onCompleteInspection: () => void;
  onInspectionChange: (field: keyof InspectionValues, value: string) => void; onInspectionSubmit: () => void;
  onOpenInspection: () => void; onOpenVerification: () => void; onProceed: () => void;
  onVerificationChange: (value: string) => void; onVerify: () => void; state: SimulationState;
  verificationFeedback: string | null; verificationValue: string;
}) {
  const decisionStage = state.stage === "decide" || state.stage === "retry";
  return <section aria-label={copy.message.recipient} className="w-full"><p className="mb-3 font-mono text-xs tracking-[.1em] text-muted">{copy.message.recipient}</p><div className="rounded-[2.2rem] border-[7px] border-navy-700 bg-navy-950 p-2 shadow-panel"><div className="min-h-[36rem] overflow-hidden rounded-[1.65rem] border border-white/[.08] bg-navy-950"><div className="flex justify-center pt-2"><span className="h-1.5 w-16 rounded-full bg-navy-700" /></div><div className="flex items-center justify-between border-b border-white/[.08] px-4 py-3 font-mono text-[10px] text-muted"><span>{copy.scenario.timestamp}</span><span className="text-signal">SMS</span></div><div className="border-b border-white/[.08] px-4 py-4"><p className="font-mono text-xs text-ice">{copy.scenario.senderName}</p><p className="mt-1 font-mono text-[10px] text-muted">{copy.scenario.senderNumber}</p></div><div className="space-y-4 bg-navy-900/45 px-4 py-5"><div className="max-w-[94%] rounded-2xl rounded-tl-sm border border-navy-700 bg-navy-850 p-4 text-sm leading-6 text-ice"><p>{copy.scenario.message}</p><p className="mt-3 break-all border-t border-white/[.08] pt-3 font-mono text-xs text-signal">{copy.scenario.link}</p></div><EvidenceLine copy={copy} label={copy.inspect.sender} value={copy.scenario.senderNumber} /><EvidenceLine copy={copy} label={copy.inspect.link} value={copy.scenario.link} /><EvidenceLine copy={copy} label={copy.inspect.tracking} value={copy.scenario.trackingNumber} /></div><div className="border-t border-white/[.08] bg-navy-950 p-4">{state.stage === "receive" ? <ActionButton onClick={onOpenInspection}>{copy.message.inspect}</ActionButton> : null}{state.stage === "inspect" && !inspectionOpen ? <ActionButton onClick={onOpenInspection}>{copy.message.inspect}</ActionButton> : null}{state.stage === "inspect" && inspectionOpen ? <InspectionPanel copy={copy} onChange={onInspectionChange} onClose={onCloseInspection} onComplete={onCompleteInspection} onSubmit={onInspectionSubmit} submitted={inspectionSubmitted} values={inspectionValues} /> : null}{state.stage === "verify" ? <VerificationPanel copy={copy} onChange={onVerificationChange} onOpen={onOpenVerification} onProceed={onProceed} onVerify={onVerify} open={state.verificationOpen} result={verificationFeedback} value={verificationValue} /> : null}{decisionStage ? <DecisionList copy={copy} onChoose={onChoose} /> : null}</div></div></div></section>;
}

function EvidenceLine({ copy, label, value }: { copy: Copy; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copyValue = async () => { if (!navigator.clipboard?.writeText) return; try { await navigator.clipboard.writeText(value); setCopied(true); } catch { /* Typing the visible value remains available. */ } };
  return <div className="flex items-center justify-between gap-3 border border-white/[.08] bg-navy-950 px-3 py-2"><span className="font-mono text-[10px] text-muted">{label}: <span className="text-ice">{value}</span></span><button className="font-mono text-[10px] text-signal" type="button" onClick={copyValue}>{copied ? copy.message.copied : copy.message.copy}</button></div>;
}

function InspectionPanel({ copy, onChange, onClose, onComplete, onSubmit, submitted, values }: { copy: Copy; onChange: (field: keyof InspectionValues, value: string) => void; onClose: () => void; onComplete: () => void; onSubmit: () => void; submitted: boolean; values: InspectionValues }) {
  const matches = { sender: normalize(values.sender) === normalize(copy.scenario.senderNumber), link: normalize(values.link) === normalize(copy.scenario.link), tracking: normalize(values.tracking) === normalize(copy.scenario.trackingNumber) };
  const complete = Boolean(values.sender && values.link && values.tracking);
  const valid = complete && matches.sender && matches.link && matches.tracking;
  const set = (field: keyof InspectionValues) => (event: React.ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value);
  return <section aria-label={copy.inspect.title} className="min-w-0"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] text-signal">{copy.message.label}</p><h2 className="mt-2 text-lg font-semibold text-ice">{copy.inspect.title}</h2></div><QuietButton onClick={onClose}>{copy.inspect.back}</QuietButton></div><p className="mt-2 text-xs leading-5 text-muted">{copy.inspect.description}</p><div className="mt-4 space-y-3"><Input label={copy.inspect.sender} onChange={set("sender")} value={values.sender} /><Input label={copy.inspect.link} onChange={set("link")} value={values.link} /><Input label={copy.inspect.tracking} onChange={set("tracking")} value={values.tracking} /></div><button className="mt-4 min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950" type="button" onClick={onSubmit}>{copy.inspect.submit}</button>{submitted && !complete ? <p className="mt-3 text-xs text-warning">{copy.inspect.incomplete}</p> : null}{submitted && complete ? <div className="mt-4 space-y-3 border-t border-white/[.08] pt-4"><p className="font-mono text-xs text-ice">{copy.inspect.resultTitle}</p><MatchRow label={copy.inspect.sender} matched={matches.sender} copy={copy} /><MatchRow label={copy.inspect.link} matched={matches.link} copy={copy} /><MatchRow label={copy.inspect.tracking} matched={matches.tracking} copy={copy} />{valid ? <><p className="text-xs leading-5 text-muted">{copy.inspect.senderResult}</p><p className="text-xs leading-5 text-muted">{copy.inspect.linkResult}</p><p className="text-xs leading-5 text-muted">{copy.inspect.trackingResult}</p><div className="border-l border-warning/50 pl-3"><p className="font-mono text-[10px] text-warning">{copy.inspect.redirect}</p>{copy.scenario.redirectChain.map((item, index) => <p className="mt-1 break-all font-mono text-[10px] text-muted" key={item}>{index ? "↳ " : ""}{item}</p>)}</div><ActionButton onClick={onComplete}>{copy.inspect.continue}</ActionButton></> : null}</div> : null}</section>;
}

function VerificationPanel({ copy, onChange, onOpen, onProceed, onVerify, open, result, value }: { copy: Copy; onChange: (value: string) => void; onOpen: () => void; onProceed: () => void; onVerify: () => void; open: boolean; result: string | null; value: string }) {
  if (!open) return <div className="space-y-3"><p className="text-xs leading-5 text-muted">{copy.verify.description}</p><div className="flex flex-wrap gap-2"><ActionButton onClick={onOpen}>{copy.verify.open}</ActionButton><QuietButton onClick={onProceed}>{copy.verify.skip}</QuietButton></div></div>;
  return <div className="space-y-3 rounded-xl border border-signal/30 bg-[#e7eee9] p-4 text-[#16241e]"><p className="font-mono text-[10px] font-bold">{copy.verify.portal}</p><input aria-label={copy.verify.placeholder} className="w-full border border-[#aab9ae] bg-white px-3 py-2 font-mono text-xs" placeholder={copy.verify.placeholder} value={value} onChange={(event) => onChange(event.target.value)} /><button className="min-h-10 bg-[#193c2e] px-3 font-mono text-xs text-white" type="button" onClick={onVerify}>{copy.verify.check}</button>{result ? <div className="border-l-4 border-[#2f6c4c] bg-white p-3"><p className="text-xs leading-5">{result}</p><p className="mt-2 text-xs leading-5 text-[#53635a]">{copy.verify.lesson}</p><button className="mt-3 border border-[#193c2e] px-3 py-2 font-mono text-xs" type="button" onClick={onProceed}>{copy.verify.close}</button></div> : null}</div>;
}

function DecisionList({ copy, onChoose }: { copy: Copy; onChoose: (decision: Decision) => void }) {
  return <div className="space-y-2"><p className="font-mono text-xs text-ice">{copy.decide.title}</p><p className="text-xs leading-5 text-muted">{copy.decide.description}</p>{decisions.map(({ decision, key }) => <button className="block w-full border border-white/[.1] bg-navy-900 px-3 py-3 text-left hover:border-signal/60" key={decision} type="button" onClick={() => onChoose(decision)}><span className="font-mono text-xs text-ice">{copy.decide.options[key].label}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{copy.decide.options[key].description}</span></button>)}</div>;
}

function RouteAnalysis({ copy, decision, state }: { copy: Copy; decision: Decision | null; state: SimulationState }) {
  const unsafe = decision ? isUnsafe(decision) : false;
  const outcome = unsafe ? copy.analysis.outcomes.unsafe : copy.analysis.outcomes.safe;
  const current = state.stage === "receive" ? copy.analysis.receiveRoute : state.stage === "inspect" ? copy.analysis.inspectRoute : state.stage === "verify" ? copy.analysis.verifyRoute : copy.analysis.decisionRoute;
  return <aside aria-label={copy.analysis.label} className="border border-white/[.1] bg-[#070d13] shadow-panel"><div className="border-b border-white/[.08] px-5 py-4"><p className="font-mono text-xs tracking-[.1em] text-ice">{copy.analysis.label}</p></div><div className="grid gap-5 p-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"><AnalysisItem label={copy.analysis.status} value={decision ? outcome.status : copy.analysis.pending} /><AnalysisItem label={copy.analysis.control} value={decision ? outcome.control : copy.analysis.pending} /><AnalysisItem label={copy.analysis.currentRoute} value={decision ? outcome.next : current} /></div>{decision ? <div className="border-t border-white/[.08] p-5"><p className="font-mono text-[10px] text-signal">{copy.analysis.observed}</p><p className="mt-2 text-sm leading-6 text-ice">{unsafe ? copy.analysis.unsafeObserved : copy.analysis.safeObserved}</p><p className="mt-5 font-mono text-[10px] text-signal">{copy.analysis.matters}</p><p className="mt-2 text-sm leading-6 text-ice">{unsafe ? copy.analysis.unsafeMatters : copy.analysis.safeMatters}</p><p className="mt-5 font-mono text-[10px] text-signal">{copy.analysis.action}</p><p className="mt-2 text-sm leading-6 text-ice">{copy.analysis.safeAction}</p></div> : null}</aside>;
}

function AnalysisItem({ label, value }: { label: string; value: string }) { return <div><p className="font-mono text-[10px] text-muted">{label}</p><p className="mt-2 text-xs leading-5 text-ice">{value}</p></div>; }
function MatchRow({ copy, label, matched }: { copy: Copy; label: string; matched: boolean }) { return <p className={`font-mono text-[10px] ${matched ? "text-signal" : "text-warning"}`}>{label}: {matched ? copy.inspect.match : copy.inspect.mismatch}</p>; }
function Input({ label, onChange, value }: { label: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; value: string }) { return <label className="block font-mono text-[10px] text-muted">{label}<input className="mt-2 w-full border border-navy-700 bg-navy-900 px-3 py-2 text-xs text-ice" value={value} onChange={onChange} /></label>; }
function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button className="min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950" type="button" onClick={onClick}>{children} <span aria-hidden="true">→</span></button>; }
function QuietButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button className="min-h-11 border border-white/[.14] px-4 font-mono text-xs text-ice" type="button" onClick={onClick}>{children}</button>; }
function ProgressRail({ active, checkpoints }: { active: number; checkpoints: readonly string[] }) { return <ol className="mt-7 grid grid-cols-5 border-y border-white/[.08]">{checkpoints.map((checkpoint, index) => <li className={`min-w-0 border-b-2 px-2 py-3 font-mono text-[10px] sm:px-3 ${index === active ? "border-signal text-signal" : index < active ? "border-ice/50 text-ice" : "border-transparent text-muted"}`} key={checkpoint}>{checkpoint}</li>)}</ol>; }
function normalize(value: string) { return value.trim().replace(/\s+/g, "").toLowerCase(); }
function isUnsafe(decision: Decision) { return decision === "open_link" || decision === "reply_sender"; }
