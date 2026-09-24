"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordModuleCompletion, type PracticeProgress } from "@/features/progress/progress";
import { persistPracticeEvent, persistProgressSnapshot, startPracticeAttempt, type PracticeAttemptResult, type PracticeEventMetadata, type PracticeEventType, type RemoteSyncResult } from "@/features/progress/supabase-persistence";
import { getMessages, type Messages } from "@/lib/i18n";
import { executableFileReducer, initialExecutableFileState, type ExecutableFileState } from "../simulation-machine";
import type { ExecutableFileStage, FileDecision } from "../types";

type Copy = Messages["executableFile"];
type OptionKey = keyof Copy["decide"]["options"];
const options: Array<{ decision: FileDecision; key: OptionKey }> = [{ decision: "open", key: "open" }, { decision: "verify", key: "verify" }, { decision: "ignore", key: "ignore" }, { decision: "report", key: "report" }];
const stageIndex: Record<ExecutableFileStage, number> = { briefing: 0, receive: 0, inspect: 1, decide: 2, reveal: 3, complete: 3 };
const persistenceStage: Record<ExecutableFileStage, "briefing" | "receive" | "inspect" | "decide" | "reveal" | "complete"> = { briefing: "briefing", receive: "receive", inspect: "inspect", decide: "decide", reveal: "reveal", complete: "complete" };

export function ExecutableFileSimulation() {
  const copy = getMessages().executableFile;
  const [state, dispatch] = useReducer(executableFileReducer, initialExecutableFileState);
  const [progress, setProgress] = useState<PracticeProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncResult["status"] | null>(null);
  const attempt = useRef<Promise<PracticeAttemptResult> | null>(null);
  const attemptId = useRef<string | null>(null);
  const recorded = useRef(new Set<string>());
  const complete = useRef(false);
  const ensureAttempt = useCallback(() => {
    if (!attempt.current) attempt.current = startPracticeAttempt("executable-file").then((result) => { attemptId.current = result.attemptId; return result; }).catch(() => ({ attemptId: null, status: "local_only" as const, reason: "remote_error" as const }));
    return attempt.current;
  }, []);
  const recordEvent = useCallback((key: string, eventType: PracticeEventType, stage: ExecutableFileStage, metadata?: PracticeEventMetadata) => {
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    void ensureAttempt().then(({ attemptId: id }) => persistPracticeEvent({ attemptId: id, eventType, stage: persistenceStage[stage], metadata })).catch(() => undefined);
  }, [ensureAttempt]);
  useEffect(() => { if (state.stage !== "briefing") recordEvent(`stage:${state.stage}`, "stage_viewed", state.stage); }, [recordEvent, state.stage]);
  useEffect(() => {
    if (state.stage !== "complete" || !state.decision || complete.current) return;
    complete.current = true;
    const outcome = state.decision === "open" ? "unsafe" : "safe";
    const next = recordModuleCompletion({ moduleId: "executable-file", outcome, habits: { inspect: true, verify: state.decision === "verify", report: state.decision === "report" } });
    setProgress(next);
    recordEvent("module-completed", "module_completed", "complete", { outcome });
    void ensureAttempt().then(({ attemptId: id }) => id ? persistProgressSnapshot({ progress: next, moduleId: "executable-file", attemptId: id }) : { status: "local_only" as const }).then((result) => setSyncStatus(result.status)).catch(() => setSyncStatus("local_only"));
  }, [ensureAttempt, recordEvent, state.decision, state.stage]);
  const begin = () => { recordEvent("module-started", "module_started", "briefing"); dispatch({ type: "start" }); };
  const inspect = () => { recordEvent("source-inspected", "sender_inspected", "inspect", { source: "simulated_message" }); recordEvent("file-inspected", "link_inspected", "inspect", { file: "simulated" }); dispatch({ type: "inspect" }); };
  const choose = (decision: FileDecision) => { recordEvent("decision", "decision_selected", "decide", { choice: decision }); recordEvent("analysis", "attacker_pov_viewed", "reveal", { choice: decision }); dispatch({ type: "select", decision }); };
  const unsafe = state.decision === "open";

  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10"><header className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="font-mono text-xs tracking-[.12em] text-signal">{copy.label}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-muted">{copy.description}</p></div><p className="border border-signal/30 px-3 py-2 font-mono text-[11px] text-signal">{copy.safeNote}</p></header><ProgressRail active={stageIndex[state.stage]} checkpoints={copy.checkpoints} />{state.stage === "briefing" ? <section className="mt-7 border-b border-white/[.08] pb-6"><ActionButton onClick={begin}>{copy.begin}</ActionButton></section> : <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-12"><FileMessage copy={copy} state={state} onInspect={inspect} onDecide={() => dispatch({ type: "decide" })} onChoose={choose} /><FileAnalysis copy={copy} unsafe={unsafe} decision={state.decision} /></div>}{state.stage === "reveal" ? <div className="mt-6"><ActionButton onClick={() => dispatch({ type: "complete" })}>{copy.analysis.finish}</ActionButton></div> : null}{state.stage === "complete" ? <section className="mt-8 flex flex-wrap justify-between gap-4 border-t border-white/[.08] pt-6"><div><p className="font-mono text-xs text-signal">{copy.complete.title}</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted">{copy.complete.description}</p>{progress ? <p className="mt-2 font-mono text-[11px] text-muted">{progress.modulesCompleted} {copy.complete.modules}</p> : null}{syncStatus === "local_only" ? <p className="mt-2 font-mono text-[11px] text-warning">{copy.complete.sync}</p> : null}</div><Link className="font-mono text-xs text-signal" href="/">{copy.complete.back} →</Link></section> : null}</main>;
}

function FileMessage({ copy, onChoose, onDecide, onInspect, state }: { copy: Copy; onChoose: (decision: FileDecision) => void; onDecide: () => void; onInspect: () => void; state: ExecutableFileState }) { return <section><p className="mb-3 font-mono text-xs tracking-[.1em] text-muted">{copy.recipient}</p><div className="rounded-[2.2rem] border-[7px] border-navy-700 bg-navy-950 p-2 shadow-panel"><div className="min-h-[34rem] overflow-hidden rounded-[1.65rem] border border-white/[.08] bg-navy-950"><div className="flex justify-center pt-2"><span className="h-1.5 w-16 rounded-full bg-navy-700" /></div><div className="flex items-center justify-between border-b border-white/[.08] px-4 py-3 font-mono text-[10px] text-muted"><span>{copy.scenario.timestamp}</span><span className="text-signal">{copy.recipient}</span></div><div className="border-b border-white/[.08] px-4 py-4"><p className="break-all font-mono text-[10px] text-ice">{copy.scenario.sender}</p></div><div className="space-y-4 bg-navy-900/45 px-4 py-5"><div className="rounded-2xl rounded-tl-sm border border-navy-700 bg-navy-850 p-4 text-sm leading-6 text-ice">{copy.scenario.message}</div><div className="border border-warning/40 bg-warning/[.05] p-4"><Image alt="" aria-hidden className="mb-3 h-auto max-h-40 w-full rounded-lg object-cover" height={971} src="/media/malicious.webp" width={1619} /><p className="font-mono text-[10px] text-warning">{copy.scenario.fileName}</p><p className="mt-2 break-all font-mono text-[10px] text-muted">{copy.scenario.link}</p></div>{state.stage === "inspect" || state.stage === "decide" || state.stage === "reveal" || state.stage === "complete" ? <dl className="border border-white/[.08] bg-navy-950"><Detail label={copy.inspect.source} value={copy.scenario.sender} /><Detail label={copy.inspect.file} value={copy.scenario.fileName} /><Detail label={copy.inspect.extension} value={copy.scenario.extension} /><Detail label={copy.inspect.link} value={copy.scenario.link} /></dl> : null}</div><div className="border-t border-white/[.08] bg-navy-950 p-4">{state.stage === "receive" ? <ActionButton onClick={onInspect}>{copy.inspect.title}</ActionButton> : null}{state.stage === "inspect" ? <div><p className="text-xs leading-5 text-muted">{copy.inspect.description}</p><p className="mt-3 text-xs leading-5 text-warning">{copy.inspect.note}</p><ActionButton onClick={onDecide}>{copy.inspect.continue}</ActionButton></div> : null}{state.stage === "decide" ? <div className="space-y-2"><p className="font-mono text-xs text-ice">{copy.decide.title}</p>{options.map(({ decision, key }) => <button className="block w-full border border-white/[.1] bg-navy-900 px-3 py-3 text-left hover:border-signal/60" key={decision} type="button" onClick={() => onChoose(decision)}><span className="font-mono text-xs text-ice">{copy.decide.options[key].label}</span><span className="mt-1 block text-[11px] leading-4 text-muted">{copy.decide.options[key].description}</span></button>)}</div> : null}</div></div></div></section>; }
function FileAnalysis({ copy, decision, unsafe }: { copy: Copy; decision: FileDecision | null; unsafe: boolean }) { return <aside className="border border-white/[.1] bg-[#070d13]"><div className="border-b border-white/[.08] px-5 py-4"><p className="font-mono text-xs tracking-[.1em] text-ice">{copy.analysis.label}</p></div><div className="space-y-5 p-5"><AnalysisItem label={copy.analysis.status} value={decision ? unsafe ? copy.analysis.risky : copy.analysis.interrupted : copy.analysis.pending} />{decision ? <><AnalysisItem label={copy.analysis.impact} value={unsafe ? copy.analysis.unsafe : copy.analysis.safe} /><AnalysisItem label={copy.analysis.why} value={copy.analysis.whyValue} /><AnalysisItem label={copy.analysis.safer} value={copy.analysis.saferValue} /></> : <AnalysisItem label={copy.analysis.why} value={copy.inspect.note} />}</div></aside>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="border-b border-white/[.08] px-3 py-2 last:border-0"><dt className="font-mono text-[10px] text-muted">{label}</dt><dd className="mt-1 break-all font-mono text-[11px] text-ice">{value}</dd></div>; }
function ProgressRail({ active, checkpoints }: { active: number; checkpoints: readonly string[] }) { return <ol className="mt-7 grid grid-cols-4 border-y border-white/[.08]">{checkpoints.map((checkpoint, index) => <li className={`min-w-0 border-b-2 px-2 py-3 font-mono text-[10px] sm:px-3 ${index === active ? "border-signal text-signal" : index < active ? "border-ice/50 text-ice" : "border-transparent text-muted"}`} key={checkpoint}>{checkpoint}</li>)}</ol>; }
function AnalysisItem({ label, value }: { label: string; value: string }) { return <div><p className="font-mono text-[10px] text-signal">{label}</p><p className="mt-2 text-sm leading-6 text-ice">{value}</p></div>; }
function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button className="mt-4 min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950" type="button" onClick={onClick}>{children} <span aria-hidden="true">→</span></button>; }
