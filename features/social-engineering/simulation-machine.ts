import type { MitigationId, SocialArtifactId, SocialEngineeringStage } from "./types";

export type SocialEngineeringState = {
  stage: SocialEngineeringStage;
  selectedArtifacts: SocialArtifactId[];
  mitigation: MitigationId | null;
};

export type SocialEngineeringAction =
  | { type: "start_module" }
  | { type: "toggle_artifact"; artifact: SocialArtifactId }
  | { type: "continue_board" }
  | { type: "continue_connect" }
  | { type: "continue_model" }
  | { type: "select_mitigation"; mitigation: MitigationId }
  | { type: "show_analysis" }
  | { type: "complete_module" };

export const initialSocialEngineeringState: SocialEngineeringState = {
  stage: "briefing",
  selectedArtifacts: [],
  mitigation: null,
};

export function socialEngineeringReducer(state: SocialEngineeringState, action: SocialEngineeringAction): SocialEngineeringState {
  switch (action.type) {
    case "start_module":
      return state.stage === "briefing" ? { ...state, stage: "board" } : state;
    case "toggle_artifact":
      if (state.stage !== "board") return state;
      return state.selectedArtifacts.includes(action.artifact)
        ? { ...state, selectedArtifacts: state.selectedArtifacts.filter((item) => item !== action.artifact) }
        : { ...state, selectedArtifacts: [...state.selectedArtifacts, action.artifact] };
    case "continue_board":
      return state.stage === "board" && state.selectedArtifacts.length >= 2 ? { ...state, stage: "connect" } : state;
    case "continue_connect":
      return state.stage === "connect" ? { ...state, stage: "model" } : state;
    case "continue_model":
      return state.stage === "model" ? { ...state, stage: "defend" } : state;
    case "select_mitigation":
      return state.stage === "defend" ? { ...state, mitigation: action.mitigation } : state;
    case "show_analysis":
      return state.stage === "defend" && state.mitigation ? { ...state, stage: "reveal" } : state;
    case "complete_module":
      return state.stage === "reveal" ? { ...state, stage: "complete" } : state;
    default:
      return state;
  }
}
