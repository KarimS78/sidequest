import type { Locale } from "./locale";
import { common, nav } from "./common";
import { landing } from "./landing";
import { draw } from "./draw";
import { profile } from "./profile";
import { saves } from "./saves";
import { shelf } from "./shelf";
import { connect } from "./connect";

// One dictionary assembled per locale, section by section. Each section file
// declares its French as `typeof en`, so a key added on one side and forgotten
// on the other is a type error rather than a blank on a screen.

export function dictionary(locale: Locale) {
  return {
    common: common[locale],
    nav: nav[locale],
    landing: landing[locale],
    draw: draw[locale],
    profile: profile[locale],
    saves: saves[locale],
    shelf: shelf[locale],
    connect: connect[locale],
  };
}

export type Dict = ReturnType<typeof dictionary>;

export * from "./locale";
export * from "./reasons";
export { eggCopy } from "./profile";
