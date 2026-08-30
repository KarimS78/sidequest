/**
 * The roast bench: the derived stats and a few roasts, both languages, on
 * both shelves.
 *
 *   npx tsx scripts/bench/roast.ts
 */
import { roastBacklog } from "@/lib/roast";
import { SAMPLE_LIBRARY, computeBacklogStats } from "@/lib/library";
import { REAL } from "./real-library";

for (const [name, lib] of [["sample", SAMPLE_LIBRARY], ["real", REAL]] as const) {
  const stats = computeBacklogStats(lib.map((g) => ({ ...g, coverUrl: "", tags: g.tags ?? [] })));
  console.log(`\n==== ${name}: ${stats.total} games ====`);
  console.log(JSON.stringify({ podium: stats.podium, podiumShare: +stats.podiumShare.toFixed(2), topTag: stats.topTag, genres: stats.genres.map(g=>`${g.tag}:${g.count}`).join(", "), shortestTry: stats.shortestTry, bigUnopened: stats.bigUnopened, coopUnopened: stats.coopUnopened, recentHours: stats.recentHours, recentGames: stats.recentGames, ownedIn: stats.ownedIn, hoursIn: stats.hoursIn, freeHours: stats.freeHours, medianHours: stats.medianHours }));
  for (const locale of ["en", "fr"] as const) {
    for (let i = 0; i < 2; i++) {
      const r = roastBacklog(stats, locale);
      if (!r.ok) continue;
      console.log(`\n[${locale}] ${r.roast.verdict}`);
      for (const l of r.roast.lines) console.log(`   • ${l}`);
      console.log(`   ↳ ${r.roast.redemption}`);
    }
  }
}
