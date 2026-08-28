"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { dictionary, type Dict } from "./index";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_MAX_AGE,
  type Locale,
} from "./locale";

/**
 * The language handover.
 *
 * The server decides the first paint from the cookie; from then on this holds
 * it in state, so switching is a re-render and not a round-trip. Writing the
 * cookie back is what makes the *next* server render agree with the screen the
 * player is looking at — without it, a reload would silently switch back.
 */
type I18n = { locale: Locale; setLocale: (l: Locale) => void; d: Dict };

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_MAX_AGE};samesite=lax`;
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, d: dictionary(locale) }),
    [locale, setLocale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  // Outside the provider (a stray render, a test) English is a working app
  // rather than a crash.
  return ctx ?? { locale: DEFAULT_LOCALE, setLocale: () => {}, d: dictionary(DEFAULT_LOCALE) };
}
