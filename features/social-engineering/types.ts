export const socialEngineeringStages = [
  "briefing",
  "board",
  "connect",
  "model",
  "defend",
  "reveal",
  "complete",
] as const;

export type SocialEngineeringStage = (typeof socialEngineeringStages)[number];
export type SocialArtifactId = "profile" | "routine" | "handle" | "contact" | "interest";
export type MitigationId = "limit" | "separate" | "verify";

export type SocialEngineeringDecision = "comply_with_request" | "verify_independently" | "report_offer" | "stay_on_platform";
export type SocialEngineeringSignal = "seller" | "payment";
export type StoredSocialEngineeringStage = "context" | "trust" | "channel_shift" | "pressure" | "decide" | "retry";
