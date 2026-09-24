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
export type Decision =
  | "open_link"
  | "official_channel"
  | "ignore_message"
  | "report_message"
  | "reply_sender"
  | "verify_official_channel"
  | "report_delete";
