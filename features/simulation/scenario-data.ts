import type { Messages } from "@/lib/i18n";

export type CourierScenarioId = "primary" | "retry";
export type CourierScenarioCopy = keyof Messages["simulation"]["scenarios"];

export type CourierScenario = {
  id: CourierScenarioId;
  copyKey: CourierScenarioCopy;
};

export const courierScenarios: Record<CourierScenarioId, CourierScenario> = {
  primary: { id: "primary", copyKey: "primary" },
  retry: { id: "retry", copyKey: "retry" },
};

