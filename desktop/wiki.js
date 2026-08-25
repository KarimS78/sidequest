// Free game-knowledge grounding via MediaWiki/Fandom APIs (no key needed).
// Search the game's wiki for the player's question, fetch the top articles'
// wikitext, clean it lightly, and return it as context for the model.
const https = require("https");

const UA = "SideQuest/0.1 (gaming companion; contact: local)";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": UA } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

// Strip the heaviest wiki markup so the model gets readable prose.
function cleanWikitext(w) {
  let t = w;
  let prev;
  do {
    prev = t;
    t = t.replace(/\{\{[^{}]*\}\}/g, ""); // templates / infoboxes (innermost out)
  } while (t !== prev);
  t = t.replace(/\{\|[\s\S]*?\|\}/g, ""); // tables
  t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, ""); // media
  t = t.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2"); // [[a|b]] -> b
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1"); // [url text] -> text
  t = t.replace(/\[https?:\/\/\S+\]/g, "");
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  t = t.replace(/<ref[^>]*\/>/gi, "");
  t = t.replace(/<[^>]+>/g, ""); // remaining html
  t = t.replace(/'''?/g, ""); // bold/italic
  t = t.replace(/^=+\s*(.*?)\s*=+$/gm, "\n$1:"); // == Heading == -> Heading:
  t = t.replace(/^[\*#:;]+\s*/gm, "- "); // list markers
  t = t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return t;
}

// Natural-language questions ("how do I parry?") don't match wiki search well —
// strip question/stop words down to the meaningful keywords.
const STOP = new Set(
  ("how do i the a an to in on of and or is are am my me you your yours what where " +
    "when why which who whom can could should would will this that these those with " +
    "for from get got getting find finding go near at it its as be been being there " +
    "here about into out up down best good better way s t").split(" ")
);
function keywords(q) {
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  return words.join(" ").trim() || q.trim();
}

async function doSearch(apiBase, q) {
  const url =
    apiBase +
    "?action=query&list=search&format=json&srlimit=3&srsearch=" +
    encodeURIComponent(q);
  const sr = await getJson(url);
  return (sr.query && sr.query.search) || [];
}

// Returns { sources: ["Title", ...], text: "..." }.
async function searchWiki(apiBase, rawQuery, maxChars = 4500) {
  if (!apiBase || !rawQuery) return { sources: [], text: "" };
  const q = keywords(rawQuery);

  let hits = await doSearch(apiBase, q);
  if (!hits.length && q.includes(" ")) {
    // Fallback: try the single longest keyword on its own.
    const longest = q.split(" ").sort((a, b) => b.length - a.length)[0];
    if (longest) hits = await doSearch(apiBase, longest);
  }
  if (!hits.length) return { sources: [], text: "" };

  const sources = [];
  let text = "";
  for (const h of hits.slice(0, 2)) {
    try {
      const pr = await getJson(
        apiBase + "?action=parse&format=json&prop=wikitext&pageid=" + h.pageid
      );
      const w = pr.parse && pr.parse.wikitext && pr.parse.wikitext["*"];
      if (w) {
        sources.push(h.title);
        text += "## " + h.title + "\n" + cleanWikitext(w) + "\n\n";
      }
    } catch {
      /* skip a page that fails */
    }
    if (text.length > maxChars) break;
  }
  return { sources, text: text.slice(0, maxChars) };
}

module.exports = { searchWiki };
