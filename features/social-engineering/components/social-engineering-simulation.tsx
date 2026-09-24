"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { recordModuleCompletion, type PracticeProgress } from "@/features/progress/progress";
import { persistPracticeEvent, persistProgressSnapshot, startPracticeAttempt, type PracticeAttemptResult, type PracticeEventMetadata, type PracticeEventType, type RemoteSyncResult } from "@/features/progress/supabase-persistence";
import { getMessages, type Messages } from "@/lib/i18n";
import { initialSocialEngineeringState, socialEngineeringReducer, type SocialEngineeringState } from "../simulation-machine";
import type { MitigationId, SocialArtifactId, SocialEngineeringStage } from "../types";

type Copy = Messages["socialEngineering"]["redesign"];

const stageIndex: Record<SocialEngineeringStage, number> = { briefing: 0, board: 0, connect: 1, model: 2, defend: 3, reveal: 4, complete: 4 };
const persistenceStage: Record<SocialEngineeringStage, "briefing" | "receive" | "inspect" | "verify" | "decide" | "reveal" | "complete"> = { briefing: "briefing", board: "receive", connect: "inspect", model: "inspect", defend: "verify", reveal: "reveal", complete: "complete" };

export function SocialEngineeringSimulation() {
  const copy = getMessages().socialEngineering.redesign;
  const [state, dispatch] = useReducer(socialEngineeringReducer, initialSocialEngineeringState);
  const [progress, setProgress] = useState<PracticeProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncResult["status"] | null>(null);
  const attempt = useRef<Promise<PracticeAttemptResult> | null>(null);
  const attemptId = useRef<string | null>(null);
  const recorded = useRef(new Set<string>());
  const completed = useRef(false);

  const ensureAttempt = useCallback(() => {
    if (!attempt.current) attempt.current = startPracticeAttempt("social-engineering").then((result) => { attemptId.current = result.attemptId; return result; }).catch(() => ({ attemptId: null, status: "local_only" as const, reason: "remote_error" as const }));
    return attempt.current;
  }, []);
  const recordEvent = useCallback((key: string, eventType: PracticeEventType, stage: SocialEngineeringStage, metadata?: PracticeEventMetadata) => {
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    void ensureAttempt().then(({ attemptId: id }) => persistPracticeEvent({ attemptId: id, eventType, stage: persistenceStage[stage], metadata })).catch(() => undefined);
  }, [ensureAttempt]);

  useEffect(() => { if (state.stage !== "briefing") recordEvent(`stage:${state.stage}`, "stage_viewed", state.stage); }, [recordEvent, state.stage]);
  useEffect(() => {
    if (state.stage !== "complete" || completed.current) return;
    completed.current = true;
    const next = recordModuleCompletion({ moduleId: "social-engineering", outcome: "safe", habits: { inspect: state.selectedArtifacts.length > 0, verify: state.mitigation === "verify" } });
    setProgress(next);
    recordEvent("module-completed", "module_completed", "complete", { outcome: "safe" });
    void ensureAttempt().then(({ attemptId: id }) => id ? persistProgressSnapshot({ progress: next, moduleId: "social-engineering", attemptId: id }) : { status: "local_only" as const }).then((result) => setSyncStatus(result.status)).catch(() => setSyncStatus("local_only"));
  }, [ensureAttempt, recordEvent, state.mitigation, state.selectedArtifacts.length, state.stage]);

  const begin = () => { recordEvent("module-started", "module_started", "briefing"); dispatch({ type: "start_module" }); };
  const selectMitigation = (mitigation: MitigationId) => { recordEvent("mitigation-selected", "decision_selected", "defend", { mitigation }); dispatch({ type: "select_mitigation", mitigation }); };
  const selectedArtifacts = copy.board.artifacts.filter((artifact) => state.selectedArtifacts.includes(artifact.id as SocialArtifactId));
  const selectedMitigation = copy.defend.options.find((option) => option.id === state.mitigation) ?? null;

  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="font-mono text-xs tracking-[.12em] text-signal">{copy.label}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ice sm:text-4xl">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-muted">{copy.description}</p></div><p className="border border-signal/30 px-3 py-2 font-mono text-[11px] text-signal">{copy.safeNote}</p></header>
    <ProgressRail active={stageIndex[state.stage]} checkpoints={copy.checkpoints} />
    {state.stage === "briefing" ? <section className="mt-7 border-b border-white/[.08] pb-6"><ActionButton onClick={begin}>{copy.begin}</ActionButton></section> : <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]"><LearningSurface copy={copy} dispatch={dispatch} selectedArtifacts={selectedArtifacts} state={state} onSelectMitigation={selectMitigation} /><ExposureAnalysis copy={copy} selectedArtifacts={selectedArtifacts} selectedMitigation={selectedMitigation} state={state} /></div>}
    {state.stage === "complete" ? <section className="mt-8 flex flex-wrap justify-between gap-4 border-t border-white/[.08] pt-6"><div><p className="font-mono text-xs text-signal">{copy.complete.title}</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted">{copy.complete.description}</p>{progress ? <p className="mt-2 font-mono text-[11px] text-muted">{progress.modulesCompleted} {copy.complete.modules}</p> : null}{syncStatus === "local_only" ? <p className="mt-2 font-mono text-[11px] text-warning">{copy.complete.sync}</p> : null}</div><Link className="font-mono text-xs text-signal" href="/">{copy.complete.back} →</Link></section> : null}
  </main>;
}

function LearningSurface({ copy, dispatch, onSelectMitigation, selectedArtifacts, state }: { copy: Copy; dispatch: React.Dispatch<Parameters<typeof socialEngineeringReducer>[1]>; onSelectMitigation: (mitigation: MitigationId) => void; selectedArtifacts: Copy["board"]["artifacts"]; state: SocialEngineeringState }) {
  if (state.stage === "board") return <section className="border border-white/[.1] bg-navy-900 p-5"><p className="font-mono text-xs text-signal">{copy.board.title}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{copy.board.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{copy.board.artifacts.map((artifact) => { const selected = state.selectedArtifacts.includes(artifact.id as SocialArtifactId); return <button className={`border p-4 text-left ${selected ? "border-signal bg-signal/[.06]" : "border-white/[.1] bg-navy-950"}`} key={artifact.id} type="button" onClick={() => dispatch({ type: "toggle_artifact", artifact: artifact.id as SocialArtifactId })}><span className="font-mono text-[10px] text-signal">{artifact.clue}</span><span className="mt-2 block text-sm text-ice">{artifact.title}</span><span className="mt-1 block text-xs leading-5 text-muted">{artifact.value}</span></button>; })}</div><p className="mt-4 font-mono text-[11px] text-muted">{state.selectedArtifacts.length >= 2 ? `${state.selectedArtifacts.length} ${copy.board.selected}` : copy.board.requirement}</p><ActionButton disabled={state.selectedArtifacts.length < 2} onClick={() => dispatch({ type: "continue_board" })}>{copy.board.continue}</ActionButton></section>;
  if (state.stage === "connect") return <section className="border border-white/[.1] bg-navy-900 p-5"><p className="font-mono text-xs text-signal">{copy.connect.title}</p><p className="mt-2 text-sm leading-6 text-muted">{copy.connect.description}</p><div className="mt-5 flex flex-wrap gap-2">{selectedArtifacts.map((artifact) => <span className="border border-signal/30 px-3 py-2 font-mono text-[11px] text-ice" key={artifact.id}>{artifact.title}</span>)}</div><div className="mt-5 border-l-2 border-warning/50 pl-4"><p className="font-mono text-[10px] text-warning">{copy.connect.inferenceLabel}</p><p className="mt-2 text-sm leading-6 text-ice">{copy.connect.inference}</p></div><ActionButton onClick={() => dispatch({ type: "continue_connect" })}>{copy.connect.continue}</ActionButton></section>;
  if (state.stage === "model") return <section className="border border-white/[.1] bg-navy-900 p-5"><p className="font-mono text-xs text-signal">{copy.model.title}</p><p className="mt-2 text-sm leading-6 text-muted">{copy.model.description}</p><dl className="mt-5 grid gap-px border border-white/[.08] bg-white/[.08] sm:grid-cols-2">{([[copy.model.asset, copy.model.assetValue], [copy.model.exposure, copy.model.exposureValue], [copy.model.abuse, copy.model.abuseValue], [copy.model.impact, copy.model.impactValue]] as const).map(([label, value]) => <div className="bg-navy-950 p-4" key={label}><dt className="font-mono text-[10px] text-signal">{label}</dt><dd className="mt-2 text-xs leading-5 text-ice">{value}</dd></div>)}</dl><ActionButton onClick={() => dispatch({ type: "continue_model" })}>{copy.model.continue}</ActionButton></section>;
  if (state.stage === "defend") return <section className="border border-white/[.1] bg-navy-900 p-5"><p className="font-mono text-xs text-signal">{copy.defend.title}</p><p className="mt-2 text-sm leading-6 text-muted">{copy.defend.description}</p><div className="mt-5 grid gap-3">{copy.defend.options.map((option) => <button className={`border p-4 text-left ${state.mitigation === option.id ? "border-signal bg-signal/[.06]" : "border-white/[.1] bg-navy-950"}`} key={option.id} type="button" onClick={() => onSelectMitigation(option.id as MitigationId)}><span className="font-mono text-xs text-ice">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span></button>)}</div><p className="mt-4 font-mono text-[11px] text-muted">{state.mitigation ? "" : copy.defend.requirement}</p><ActionButton disabled={!state.mitigation} onClick={() => dispatch({ type: "show_analysis" })}>{copy.defend.continue}</ActionButton></section>;
  if (state.stage === "reveal") return <section className="border border-white/[.1] bg-navy-900 p-5"><p className="font-mono text-xs text-signal">{copy.analysis.title}</p><p className="mt-3 text-sm leading-6 text-ice">{copy.analysis.summary}</p><ActionButton onClick={() => dispatch({ type: "complete_module" })}>{copy.analysis.finish}</ActionButton></section>;
  return null;
}

function ExposureAnalysis({ copy, selectedArtifacts, selectedMitigation, state }: { copy: Copy; selectedArtifacts: Copy["board"]["artifacts"]; selectedMitigation: Copy["defend"]["options"][number] | null; state: SocialEngineeringState }) {
  return <aside className="border border-white/[.1] bg-[#070d13]" aria-label={copy.analysis.title}><div className="border-b border-white/[.08] px-5 py-4"><p className="font-mono text-xs tracking-[.1em] text-ice">{copy.analysis.title}</p></div><div className="space-y-5 p-5"><AnalysisItem label={copy.analysis.observed} value={selectedArtifacts.length ? selectedArtifacts.map((artifact) => artifact.title).join(" · ") : copy.analysis.none} /><AnalysisItem label={copy.analysis.matters} value={state.stage === "board" ? copy.board.description : copy.connect.inference} /><AnalysisItem label={copy.analysis.action} value={selectedMitigation?.label ?? copy.analysis.choose} /></div></aside>;
}

function ProgressRail({ active, checkpoints }: { active: number; checkpoints: readonly string[] }) { return <ol className="mt-7 grid grid-cols-5 border-y border-white/[.08]">{checkpoints.map((checkpoint, index) => <li className={`min-w-0 border-b-2 px-2 py-3 font-mono text-[10px] sm:px-3 ${index === active ? "border-signal text-signal" : index < active ? "border-ice/50 text-ice" : "border-transparent text-muted"}`} key={checkpoint}>{checkpoint}</li>)}</ol>; }
function AnalysisItem({ label, value }: { label: string; value: string }) { return <div><p className="font-mono text-[10px] text-signal">{label}</p><p className="mt-2 text-sm leading-6 text-ice">{value}</p></div>; }
function ActionButton({ children, disabled = false, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) { return <button className="mt-5 min-h-11 border border-signal bg-signal px-4 font-mono text-xs font-bold text-navy-950 disabled:cursor-not-allowed disabled:border-navy-700 disabled:bg-navy-800 disabled:text-muted" disabled={disabled} type="button" onClick={onClick}>{children} <span aria-hidden="true">→</span></button>; }
