import type { Messages } from "@/lib/i18n";

export type MarketplaceScenarioId = "primary" | "retry";
export type MarketplaceScenarioCopy = keyof Messages["socialEngineering"]["scenarios"];

export type MarketplaceScenario = {
  id: MarketplaceScenarioId;
  copyKey: MarketplaceScenarioCopy;
};

export const marketplaceScenarios: Record<MarketplaceScenarioId, MarketplaceScenario> = {
  primary: { id: "primary", copyKey: "primary" },
  retry: { id: "retry", copyKey: "retry" },
};
