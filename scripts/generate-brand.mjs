// Derives every brand raster from one source: brand/logo-master.png, the full
// lockup Karim supplied — compass rose + S, SIDEQUEST, PLAY · TRACK · COMPLETE.
// Run by hand: `node scripts/generate-brand.mjs`.
//
// Nothing else in the repo is hand-drawn brand art. There was briefly a mark
// drawn in SVG here instead; it is gone, because the master is the master.
//
// THE RULE THAT DECIDES EVERYTHING: the lettering does not survive shrinking.
// At 32px an 8px line of capitals is a grey smear. So every square output is
// the MARK ALONE, and the full lockup appears in exactly one place — the social
// card, which is the one wide rectangle with room to read it.
//
// Uses `sharp`, which ships inside Next. Deliberately not declared as a
// dependency: it is a build tool run by hand, not something the app imports.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const MASTER = path.join(ROOT, "brand/logo-master.png");
const GROUND = { r: 8, g: 10, b: 18 };

/**
 * Where the mark is inside the master — measured, never estimated.
 *
 * The lockup is three stacked bands of bright pixels on a near-black ground:
 * the mark, the wordmark, then the tagline. Scanning rows for brightness and
 * taking the FIRST band gives the mark without hard-coding a crop that a new
 * export of the logo would silently invalidate.
 */
async function measureMark() {
  const { data, info } = await sharp(MASTER)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const LIT = 78; // above the halo, below the artwork

  const bright = (x, y) => {
    const i = (y * width + x) * channels;
    const a = channels === 4 ? data[i + 3] : 255;
    if (a < 40) return false;
    return Math.max(data[i], data[i + 1], data[i + 2]) > LIT;
  };

  // Rows that contain anything lit at all.
  const rowHasInk = [];
  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = 0; x < width; x += 2) if (bright(x, y)) ink++;
    // A handful of stray pixels is halo noise, not a band.
    rowHasInk.push(ink > 4);
  }

  // Group into bands, keep the first one: that is the mark.
  const bands = [];
  let start = -1;
  for (let y = 0; y < height; y++) {
    if (rowHasInk[y] && start === -1) start = y;
    if (!rowHasInk[y] && start !== -1) {
      if (y - start > height * 0.04) bands.push([start, y]);
      start = -1;
    }
  }
  if (start !== -1) bands.push([start, height]);
  if (!bands.length) throw new Error("no lit band found in the master");

  const [top, bottom] = bands[0];

  // Horizontal extent within that band.
  let left = width;
  let right = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      if (!bright(x, y)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  // A compass rose wants to be a square, so square it off around its centre.
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const side = Math.max(right - left, bottom - top);
  const half = side / 2;

  const box = {
    left: Math.max(0, Math.round(cx - half)),
    top: Math.max(0, Math.round(cy - half)),
    size: Math.round(side),
  };
  box.size = Math.min(box.size, width - box.left, height - box.top);

  console.log(
    `  measured mark: ${box.size}x${box.size} at (${box.left}, ${box.top}) of ${width}x${height}`
  );
  return box;
}

/**
 * The mark on its own ground, at `size`.
 *
 * `pad` is the share of the canvas left empty around it — a maskable icon needs
 * a lot of it, because Android crops a circle out and anything near a corner is
 * gone. The ground is painted rather than left transparent: the artwork carries
 * its own glow and near-black background, and knocking it out would show that
 * background as a smudge on whatever sits behind.
 */
async function markPng(box, size, pad = 0.06) {
  const inner = Math.round(size * (1 - pad * 2));
  const mark = await sharp(MASTER)
    .extract({ left: box.left, top: box.top, width: box.size, height: box.size })
    .resize(inner, inner, { fit: "cover" })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...GROUND, alpha: 1 } },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

/* ============================================================
   A hand-written ICO container.

   Windows and every browser tab still want one, and the format is three PNGs
   with a 16-byte directory entry each. Not worth a dependency.
   ============================================================ */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const out = (rel, buf) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`  ${rel}  ${(buf.length / 1024).toFixed(1)} KB`);
};

async function main() {
  console.log("Deriving the brand from brand/logo-master.png:\n");
  const box = await measureMark();
  console.log("");

  // ---- PWA and browser icons: the mark alone ----
  out("public/icon-192.png", await markPng(box, 192));
  out("public/icon-512.png", await markPng(box, 512));
  // Android crops a circle out of the maskable one, so the mark sits well in.
  out("public/icon-maskable-512.png", await markPng(box, 512, 0.22));
  out("public/apple-touch-icon.png", await markPng(box, 180, 0.1));

  // ---- the tile the UI uses ----
  out("public/brand/mark-128.png", await markPng(box, 128, 0.04));
  out("public/brand/mark-512.png", await markPng(box, 512, 0.04));

  // ---- favicon ----
  const frames = [];
  for (const size of [16, 32, 48]) {
    frames.push({ size, data: await markPng(box, size, 0.02) });
  }
  out("app/favicon.ico", ico(frames));

  // ---- the full lockup, for the one place it fits: the social card ----
  const lockup = await sharp(MASTER).trim({ threshold: 12 }).resize({ width: 760 }).png().toBuffer();
  out("public/brand/logo-full.png", lockup);
  out("assets/og-lockup.png", lockup);

  console.log("\nDone. The social card (app/opengraph-image.tsx) reads assets/og-lockup.png.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
