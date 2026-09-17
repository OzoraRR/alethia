export const simulationStages = [
  "briefing",
  "receive",
  "inspect",
  "verify",
  "decide",
  "reveal",
  "retry",
  "complete",
] as const;

export type SimulationStage = (typeof simulationStages)[number];
export type InspectionSignal = "sender" | "link";
export type Decision = "open_link" | "verify_official_channel" | "report_delete";

