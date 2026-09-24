import type { ExecutableFileStage, FileDecision } from "./types";

export type ExecutableFileState = { stage: ExecutableFileStage; decision: FileDecision | null };
export type ExecutableFileAction =
  | { type: "start" }
  | { type: "inspect" }
  | { type: "decide" }
  | { type: "select"; decision: FileDecision }
  | { type: "complete" };

export const initialExecutableFileState: ExecutableFileState = { stage: "briefing", decision: null };

export function executableFileReducer(state: ExecutableFileState, action: ExecutableFileAction): ExecutableFileState {
  switch (action.type) {
    case "start": return state.stage === "briefing" ? { ...state, stage: "receive" } : state;
    case "inspect": return state.stage === "receive" ? { ...state, stage: "inspect" } : state;
    case "decide": return state.stage === "inspect" ? { ...state, stage: "decide" } : state;
    case "select": return state.stage === "decide" ? { ...state, stage: "reveal", decision: action.decision } : state;
    case "complete": return state.stage === "reveal" ? { ...state, stage: "complete" } : state;
    default: return state;
  }
}
