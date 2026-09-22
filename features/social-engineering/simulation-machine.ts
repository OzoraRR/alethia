import type { SocialEngineeringDecision, SocialEngineeringSignal, SocialEngineeringStage } from "./types";

export type SocialEngineeringState = {
  stage: SocialEngineeringStage;
  primarySignals: SocialEngineeringSignal[];
  retrySignals: SocialEngineeringSignal[];
  decision: SocialEngineeringDecision | null;
  retryDecision: SocialEngineeringDecision | null;
};

export type SocialEngineeringAction =
  | { type: "start_module" }
  | { type: "continue_context" }
  | { type: "inspect_seller" }
  | { type: "continue_trust" }
  | { type: "stay_on_platform" }
  | { type: "accept_channel_shift" }
  | { type: "inspect_payment" }
  | { type: "continue_pressure" }
  | { type: "select_decision"; decision: SocialEngineeringDecision }
  | { type: "start_retry" }
  | { type: "inspect_retry"; signal: SocialEngineeringSignal }
  | { type: "select_retry_decision"; decision: SocialEngineeringDecision }
  | { type: "complete_module" }
  | { type: "restore_state"; state: SocialEngineeringState };

export const initialSocialEngineeringState: SocialEngineeringState = {
  stage: "briefing",
  primarySignals: [],
  retrySignals: [],
  decision: null,
  retryDecision: null,
};

export function socialEngineeringReducer(
  state: SocialEngineeringState,
  action: SocialEngineeringAction,
): SocialEngineeringState {
  switch (action.type) {
    case "start_module":
      return state.stage === "briefing" ? { ...state, stage: "context" } : state;
    case "continue_context":
      return state.stage === "context" ? { ...state, stage: "trust" } : state;
    case "inspect_seller":
      return state.stage === "trust" && !state.primarySignals.includes("seller")
        ? { ...state, primarySignals: [...state.primarySignals, "seller"] }
        : state;
    case "continue_trust":
      return state.stage === "trust" ? { ...state, stage: "channel_shift" } : state;
    case "stay_on_platform":
      return state.stage === "trust" || state.stage === "channel_shift"
        ? { ...state, stage: "reveal", decision: "stay_on_platform" }
        : state;
    case "accept_channel_shift":
      return state.stage === "channel_shift" ? { ...state, stage: "pressure" } : state;
    case "inspect_payment":
      return state.stage === "pressure" && !state.primarySignals.includes("payment")
        ? { ...state, primarySignals: [...state.primarySignals, "payment"] }
        : state;
    case "continue_pressure":
      return state.stage === "pressure" ? { ...state, stage: "decide" } : state;
    case "select_decision":
      return state.stage === "decide" ? { ...state, stage: "reveal", decision: action.decision } : state;
    case "start_retry":
      return state.stage === "reveal" && state.retryDecision === null
        ? { ...state, stage: "retry", retrySignals: [] }
        : state;
    case "inspect_retry":
      return state.stage === "retry" && !state.retrySignals.includes(action.signal)
        ? { ...state, retrySignals: [...state.retrySignals, action.signal] }
        : state;
    case "select_retry_decision":
      return state.stage === "retry" && state.retrySignals.length > 0
        ? { ...state, stage: "reveal", retryDecision: action.decision }
        : state;
    case "complete_module":
      return state.stage === "reveal" && state.retryDecision !== null ? { ...state, stage: "complete" } : state;
    case "restore_state":
      return action.state;
    default:
      return state;
  }
}
