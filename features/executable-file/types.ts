export const executableFileStages = ["briefing", "receive", "inspect", "decide", "reveal", "complete"] as const;
export type ExecutableFileStage = (typeof executableFileStages)[number];
export type FileDecision = "open" | "verify" | "ignore" | "report";
