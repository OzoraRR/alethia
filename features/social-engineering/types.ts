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
