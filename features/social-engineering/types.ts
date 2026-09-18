export const socialEngineeringStages = [
  "briefing",
  "context",
  "trust",
  "channel_shift",
  "pressure",
  "decide",
  "reveal",
  "retry",
  "complete",
] as const;

export type SocialEngineeringStage = (typeof socialEngineeringStages)[number];
export type SocialEngineeringSignal = "seller" | "payment";
export type SocialEngineeringDecision =
  | "stay_on_platform"
  | "report_offer"
  | "comply_with_request"
  | "verify_independently";
