// Tiny .env reader (no deps). Looks in desktop/.env.local first, then falls back
// to the web app's ../.env.local so the OPENAI_API_KEY is shared automatically.
const fs = require("fs");
const path = require("path");

function parseEnv(file) {
  const out = {};
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
  } catch {
    /* file missing — fine */
  }
  return out;
}

function loadEnv() {
  const local = parseEnv(path.join(__dirname, ".env.local"));
  const fromWeb = parseEnv(path.join(__dirname, "..", ".env.local"));
  return { ...fromWeb, ...local, ...process.env };
}

module.exports = { loadEnv };
