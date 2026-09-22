import type { Decision, InspectionSignal, SimulationStage } from "./types";

export type SimulationState = {
  stage: SimulationStage;
  inspectedSignals: InspectionSignal[];
  retryInspectedSignals: InspectionSignal[];
  verificationOpen: boolean;
  decision: Decision | null;
  retryDecision: Decision | null;
};

export type SimulationAction =
  | { type: "start_module" }
  | { type: "continue_receive" }
  | { type: "inspect_signal"; signal: InspectionSignal }
  | { type: "continue_inspect" }
  | { type: "open_trusted_channel" }
  | { type: "confirm_verification" }
  | { type: "select_decision"; decision: Decision }
  | { type: "start_retry" }
  | { type: "inspect_retry_signal"; signal: InspectionSignal }
  | { type: "select_retry_decision"; decision: Decision }
  | { type: "complete_module" }
  | { type: "restore_state"; state: SimulationState };

export const initialSimulationState: SimulationState = {
  stage: "briefing",
  inspectedSignals: [],
  retryInspectedSignals: [],
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
    case "continue_receive":
      return state.stage === "receive" ? { ...state, stage: "inspect" } : state;
    case "inspect_signal":
      if (state.stage !== "inspect" || state.inspectedSignals.includes(action.signal)) {
        return state;
      }

      return {
        ...state,
        inspectedSignals: [...state.inspectedSignals, action.signal],
      };
    case "continue_inspect":
      return state.stage === "inspect" && state.inspectedSignals.length > 0
        ? { ...state, stage: "verify" }
        : state;
    case "open_trusted_channel":
      return state.stage === "verify" ? { ...state, verificationOpen: true } : state;
    case "confirm_verification":
      return state.stage === "verify" && state.verificationOpen
        ? { ...state, stage: "decide", verificationOpen: false }
        : state;
    case "select_decision":
      return state.stage === "decide"
        ? { ...state, stage: "reveal", decision: action.decision }
        : state;
    case "start_retry":
      return state.stage === "reveal" && state.retryDecision === null
        ? { ...state, stage: "retry", retryDecision: null, retryInspectedSignals: [] }
        : state;
    case "inspect_retry_signal":
      if (state.stage !== "retry" || state.retryInspectedSignals.includes(action.signal)) {
        return state;
      }

      return {
        ...state,
        retryInspectedSignals: [...state.retryInspectedSignals, action.signal],
      };
    case "select_retry_decision":
      return state.stage === "retry" && state.retryInspectedSignals.length > 0
        ? { ...state, stage: "reveal", retryDecision: action.decision }
        : state;
    case "complete_module":
      return state.stage === "reveal" && state.retryDecision !== null
        ? { ...state, stage: "complete" }
        : state;
    case "restore_state":
      return action.state;
    default:
      return state;
  }
}
