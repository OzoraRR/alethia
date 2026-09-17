import en from "@/messages/en.json";
import id from "@/messages/id.json";

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export type Messages = typeof id;

const dictionaries: Record<Locale, Messages> = { id, en };

export function getMessages(locale: Locale = "id"): Messages {
  return dictionaries[locale];
}

