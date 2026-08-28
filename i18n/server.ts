import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/**
 * The locale for this request, read on the server so the first paint is already
 * in the right language and `<html lang>` is true before any JavaScript runs.
 * After that the client owns it — see i18n/context.tsx.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
