import type { Locale } from "./locale";
import { common } from "./common";
import type { PickerTime, Reason, ReasonKey } from "@/lib/recommend";

// The engine speaks in components; this file is the only place they become
// sentences. Both languages read the same six keys, so a reason can never say
// something in French that the maths did not earn in English.

/** Which of the six named components a reason belongs to. */
const COMPONENT_OF: Record<ReasonKey, keyof (typeof common)["en"]["components"]> = {
  mood: "mood",
  custom: "mood",
  shortFit: "session",
  longFit: "session",
  momentum: "momentum",
  never: "rediscovery",
  stale: "rediscovery",
  taste: "taste",
};

export function componentLabel(locale: Locale, key: ReasonKey): string {
  return common[locale].components[COMPONENT_OF[key]];
}

type Liner = (r: Reason) => string;

const q = { en: (s: string) => `“${s}”`, fr: (s: string) => `« ${s} »` };

const enLines: Record<ReasonKey, Liner> = {
  mood: (r) => `${q.en(r.data?.tag ?? "")} is the mood you asked for.`,
  custom: (r) => `${q.en(r.data?.tag ?? "")} lands on what you typed.`,
  shortFit: () => `Built for short bursts, so it fits the window you have.`,
  longFit: () => `It rewards a long sitting, and you have the evening.`,
  momentum: (r) => `${r.data?.hours ?? 0} H in the last two weeks — you are mid-run.`,
  never: () => `Never launched. It is still in its wrapper.`,
  stale: (r) => `Only ${r.data?.hours ?? 0} H in. You never really gave it a shot.`,
  taste: (r) => `${q.en(r.data?.tag ?? "")} is one of your favourite genres.`,
};

const frLines: Record<ReasonKey, Liner> = {
  mood: (r) => `${q.fr(r.data?.tag ?? "")}, exactement l'humeur demandée.`,
  custom: (r) => `${q.fr(r.data?.tag ?? "")} colle à ce que tu as écrit.`,
  shortFit: () => `Fait pour les sessions courtes, pile le créneau que tu as.`,
  longFit: () => `Il se donne sur la longueur, et tu as la soirée devant toi.`,
  momentum: (r) => `${r.data?.hours ?? 0} H dessus ces deux dernières semaines — tu es lancé.`,
  never: () => `Jamais lancé. Encore sous blister.`,
  stale: (r) => `${r.data?.hours ?? 0} H au compteur. Tu ne lui as jamais laissé sa chance.`,
  taste: (r) => `${q.fr(r.data?.tag ?? "")}, un de tes genres préférés.`,
};

const LINES: Record<Locale, Record<ReasonKey, Liner>> = { en: enLines, fr: frLines };

/** One reason, as a sentence. */
export function reasonLine(locale: Locale, r: Reason): string {
  return LINES[locale][r.key](r);
}

const NOTHING: Record<Locale, (time: string) => string> = {
  en: (t) => `Nothing on your shelf shouted louder than anything else, so this one is the roll of the dice for ${t}.`,
  fr: (t) => `Rien ne s'est détaché sur ton étagère, alors pour ${t} c'est le hasard qui tranche.`,
};

/**
 * The verdict copy: two reasons, no more. Three was a paragraph, and the panel
 * has one job — say the name, then say why, then get out of the way.
 */
export function verdictProse(
  locale: Locale,
  reasons: Reason[],
  time: PickerTime
): string {
  if (!reasons.length) return NOTHING[locale](common[locale].time[time].full);
  return reasons.slice(0, 2).map((r) => reasonLine(locale, r)).join(" ");
}
