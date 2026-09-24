import type { Decision, SimulationStage } from "./types";

export type SimulationState = {
  stage: SimulationStage;
  inspectionComplete: boolean;
  verificationComplete: boolean;
  verificationOpen: boolean;
  decision: Decision | null;
  retryDecision: Decision | null;
};

export type SimulationAction =
  | { type: "start_module" }
  | { type: "open_inspection" }
  | { type: "complete_inspection" }
  | { type: "open_trusted_channel" }
  | { type: "complete_verification" }
  | { type: "continue_to_decision" }
  | { type: "select_decision"; decision: Decision }
  | { type: "start_retry" }
  | { type: "select_retry_decision"; decision: Decision }
  | { type: "complete_module" };

export const initialSimulationState: SimulationState = {
  stage: "briefing",
  inspectionComplete: false,
  verificationComplete: false,
  verificationOpen: false,
  decision: null,
  retryDecision: null,
};

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case "start_module":
      return state.stage === "briefing" ? { ...state, stage: "receive" } : state;
    case "open_inspection":
      return state.stage === "receive" ? { ...state, stage: "inspect" } : state;
    case "complete_inspection":
      return state.stage === "inspect" ? { ...state, inspectionComplete: true, stage: "verify" } : state;
    case "open_trusted_channel":
      return state.stage === "verify" ? { ...state, verificationOpen: true } : state;
    case "complete_verification":
      return state.stage === "verify" && state.verificationOpen
        ? { ...state, verificationComplete: true }
        : state;
    case "continue_to_decision":
      return state.stage === "verify"
        ? { ...state, stage: "decide", verificationOpen: false }
        : state;
    case "select_decision":
      return state.stage === "decide"
        ? { ...state, stage: "reveal", decision: action.decision }
        : state;
    case "start_retry":
      return state.stage === "reveal" && state.retryDecision === null
        ? { ...state, stage: "retry", retryDecision: null }
        : state;
    case "select_retry_decision":
      return state.stage === "retry"
        ? { ...state, stage: "reveal", retryDecision: action.decision }
        : state;
    case "complete_module":
      return state.stage === "reveal" && state.retryDecision !== null
        ? { ...state, stage: "complete" }
        : state;
    default:
      return state;
  }
}
