/**
 * The engine bench: every preset mood × every time, plus typed sentences, on
 * the demo shelf or on a realistic 41-game one with SteamSpy-shaped tags.
 *
 *   npx tsx scripts/bench/engine.ts            # demo shelf
 *   npx tsx scripts/bench/engine.ts real       # realistic shelf
 *
 * Read it before and after touching lib/recommend.ts. Every weight in there
 * was set by looking at this output, not by reasoning about it.
 */
import { explain, type PickerGame, type PickerMood, type PickerTime } from "@/lib/recommend";
import { roastBacklog } from "@/lib/roast";
import { SAMPLE_LIBRARY, computeBacklogStats } from "@/lib/library";
import { REAL } from "./real-library";

const which = process.argv[2] ?? "sample";
const lib: PickerGame[] = which === "real" ? REAL : SAMPLE_LIBRARY;

const MOODS: PickerMood[] = ["chill", "story", "challenge", "quick"];
const TIMES: PickerTime[] = ["short", "medium", "long"];

function show(title: string, input: Parameters<typeof explain>[0]) {
  const rows = explain(input).slice(0, 5);
  console.log(`\n### ${title}`);
  for (const r of rows) {
    const comps = r.components
      .map((c) => `${c.key}${c.points >= 0 ? "+" : ""}${Math.round(c.points)}`)
      .join(" ");
    console.log(`  ${String(Math.round(r.score)).padStart(3)}  ${r.game.name.padEnd(28)} ${comps}`);
  }
}

console.log(`== ${which}: ${lib.length} games ==`);
for (const mood of MOODS) for (const time of TIMES) show(`${mood} / ${time}`, { library: lib, mood, time });

const TYPED = [
  "I want to be scared",
  "something short I don't have to think about",
  "rien de trop dur",
  "je veux souffrir",
  "une bonne histoire, tranquille",
  "un truc pour jouer avec des potes",
  "explorer un monde",
  "rien de trop long, j'ai pas la tête à ça",
];
for (const t of TYPED) show(`typed: "${t}" / medium`, { library: lib, customMood: t, time: "medium" });

console.log("\n== ROAST ==");
const stats = computeBacklogStats(lib.map((g) => ({ ...g, coverUrl: "", tags: g.tags ?? [] })));
console.log(JSON.stringify(stats, null, 1));
for (let i = 0; i < 3; i++) {
  const r = roastBacklog(stats);
  if (r.ok) {
    console.log(`\n-- ${r.roast.verdict}`);
    for (const l of r.roast.lines) console.log(`   • ${l}`);
    console.log(`   ↳ ${r.roast.redemption}`);
  }
}
