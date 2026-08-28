// The two languages, and the one place their names are written down.
//
// The locale is decided on the server (a cookie, so the first paint is already
// in the right language and <html lang> is honest for crawlers) and then owned
// by the client (switching is instant state, not a round-trip). See
// i18n/context.tsx for the handover.

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie the server reads and the switcher writes. One year. */
export const LOCALE_COOKIE = "sidequest_locale";
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** What the switcher shows: the language named in itself, never a flag. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
};
