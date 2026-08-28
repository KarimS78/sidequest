/**
 * Generates every brand asset in the app from one master file.
 *
 *   node scripts/generate-brand.mjs
 *
 * The master is brand/logo-master.png — the full lockup: the compass mark, the
 * SIDEQUEST wordmark, and the PLAY · TRACK · COMPLETE line. Nothing else in the
 * repo is hand-drawn brand art any more; if the logo changes, this file is the
 * only thing that has to run again.
 *
 * The one rule that shapes all of it: THE WORDMARK DOES NOT SURVIVE SHRINKING.
 * At 32px a tagline set in 8px caps is a grey smear, so every square output
 * here is the MARK ALONE, cropped out of the master. The full lockup is only
 * used where there is room to read it — the social preview card.
 *
 * Requires `sharp`, which is already in node_modules (Next installs it for
 * image optimisation). It is not a declared dependency of this project because
 * nothing at runtime needs it — this script is a build-time tool run by hand.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = join(ROOT, "brand", "logo-master.png");
const PUBLIC = join(ROOT, "public");
const APP = join(ROOT, "app");

/**
 * Where the mark sits inside the master, measured rather than guessed: the
 * bounding box of everything brighter than the backdrop, above the wordmark.
 * It comes out as a near-perfect square, which is what a compass rose should be.
 */
const MARK = { left: 308, top: 175, width: 638, height: 637 };

/**
 * The master's own backdrop — a very dark navy, not black. Used to pad the
 * maskable icon so the extra area cannot be seen as a border against the art.
 */
const BACKDROP = { r: 2, g: 4, b: 27, alpha: 1 };

/** The master's outermost corner — what its vignette fades out to. */
const CORNER = { r: 0, g: 0, b: 12, alpha: 1 };

/**
 * PNG settings for everything here. The art is a smooth gradient, so a plain
 * 24-bit encode came out at half a megabyte for one 512px icon — heavier than
 * the whole app shell. Quantising to a palette costs nothing visible at icon
 * sizes and divides it by five.
 */
const PNG = { compressionLevel: 9, palette: true, quality: 92, effort: 10 };

const mark = () => sharp(MASTER).extract(MARK);

/** The mark, square, at one size. */
async function markAt(size) {
  return mark().resize(size, size, { fit: "cover" }).png(PNG).toBuffer();
}

/**
 * The mark inset on the backdrop. Android masks icons to whatever shape the
 * launcher likes, and anything outside the middle 80% can be cut — so maskable
 * art has to sit well inside its own canvas rather than fill it.
 */
async function inset(size, scale) {
  const art = await mark()
    .resize(Math.round(size * scale), Math.round(size * scale), { fit: "cover" })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKDROP },
  })
    .composite([{ input: art, gravity: "centre" }])
    .png(PNG)
    .toBuffer();
}

/**
 * An .ico wrapping PNGs — the format has allowed that since Vista, and every
 * browser that still asks for /favicon.ico understands it.
 *
 * This is the "mini logo" in a Chrome tab, and the smallest the mark is ever
 * drawn. It is also why the wordmark is not in it: at 16px the compass needle
 * is already most of what survives.
 */
function ico(pngs) {
  const HEADER = 6;
  const ENTRY = 16;
  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = HEADER + ENTRY * pngs.length;
  const entries = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(ENTRY);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

/**
 * The social preview card. This is the one place the full lockup is used: a
 * link unfurled in Slack or on a timeline is a wide rectangle with room for a
 * wordmark, which is the exact opposite of a favicon.
 */
async function ogImage() {
  const W = 1200;
  const H = 630;

  // Deliberately NOT trimmed. The master carries its own soft vignette, and
  // trimming to the ink left that vignette sitting on the card as a visible
  // irregular blob. Kept whole and dropped on a background matching the
  // master's own corners, it blends into the card instead.
  const art = await sharp(MASTER)
    .resize({ height: Math.round(H * 0.98), fit: "inside" })
    .toBuffer();

  return sharp({
    create: { width: W, height: H, channels: 4, background: CORNER },
  })
    .composite([{ input: art, gravity: "centre" }])
    .png(PNG)
    .toBuffer();
}

async function main() {
  mkdirSync(join(PUBLIC, "brand"), { recursive: true });

  const out = [];
  const write = (path, data) => {
    writeFileSync(path, data);
    out.push(`${path.replace(ROOT, ".").replace(/\\/g, "/")}  ${(data.length / 1024).toFixed(1)} kB`);
  };

  // --- the mark, for the UI ------------------------------------------------
  write(join(PUBLIC, "brand", "mark-512.png"), await markAt(512));
  write(join(PUBLIC, "brand", "mark-128.png"), await markAt(128));

  // --- the full lockup, where there is room to read it ---------------------
  write(
    join(PUBLIC, "brand", "logo-full.png"),
    await sharp(MASTER).trim({ threshold: 12 }).resize({ width: 960 }).png(PNG).toBuffer()
  );

  // --- PWA ------------------------------------------------------------------
  // A touch of air: cropped flush to the art, the compass points touch the edge
  // and the icon reads as clipped next to every other one on a home screen.
  write(join(PUBLIC, "icon-192.png"), await inset(192, 0.9));
  write(join(PUBLIC, "icon-512.png"), await inset(512, 0.9));
  write(join(PUBLIC, "icon-maskable-512.png"), await inset(512, 0.62));

  // Apple does not mask, it rounds the corners — so it needs only a little air.
  write(join(PUBLIC, "apple-touch-icon.png"), await inset(180, 0.9));

  // --- the browser tab ------------------------------------------------------
  write(
    join(APP, "favicon.ico"),
    ico([
      { size: 16, data: await markAt(16) },
      { size: 32, data: await markAt(32) },
      { size: 48, data: await markAt(48) },
    ])
  );

  // --- link previews --------------------------------------------------------
  write(join(APP, "opengraph-image.png"), await ogImage());

  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
