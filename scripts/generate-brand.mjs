// Derives every brand raster from one source: the mark drawn in
// components/logo.tsx. Run by hand: `node scripts/generate-brand.mjs`.
//
// The old version cropped a painted PNG of a compass. There is no PNG master
// any more — the mark is geometry, so the master is the geometry, and this
// script is the only place it is duplicated. If the diamond or the S changes in
// logo.tsx, change MARK below and re-run; nothing else in the repo is hand-drawn
// brand art.
//
// Uses `sharp`, which ships inside Next. Deliberately not declared as a
// dependency: it is a build tool run by hand, not something the app imports.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ACCENT = "#7c5cff";
const GROUND = "#0d1114";

/**
 * The mark, at any size, on its own ground.
 *
 * `pad` is the share of the canvas left empty around it. Square app icons want
 * a little; a maskable icon wants a lot, because Android crops a circle out of
 * it and anything in the corners is gone.
 */
function markSvg(size, { pad = 0.12, ground = GROUND, radius = 0 } = {}) {
  const box = 32;
  const inner = 1 - pad * 2;
  const scale = inner;
  const offset = (box * pad) / scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}">
  <rect width="${box}" height="${box}" rx="${radius}" fill="${ground}"/>
  <g transform="scale(${scale}) translate(${offset} ${offset})">
    <rect x="5.5" y="5.5" width="21" height="21" rx="3" transform="rotate(45 16 16)" fill="${ACCENT}"/>
    <path d="M19.8 12.9C19.8 11 18.1 10.2 16 10.2C13.9 10.2 12.2 11.1 12.2 12.9C12.2 16.4 19.8 15.3 19.8 19.1C19.8 21 18 21.9 16 21.9C13.9 21.9 12.2 21 12.2 19.3"
      stroke="${ground}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

/* ============================================================
   A hand-written ICO container.

   Windows and every browser tab still want one, and the format is three PNGs
   with a 22-byte header each. Not worth a dependency.
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
  console.log("Deriving the brand from the mark:\n");

  // ---- PWA and browser icons ----
  out("public/icon-192.png", await png(markSvg(192), 192));
  out("public/icon-512.png", await png(markSvg(512), 512));
  // Maskable: Android crops a circle, so the mark sits well inside the safe area.
  out("public/icon-maskable-512.png", await png(markSvg(512, { pad: 0.24 }), 512));
  out("public/apple-touch-icon.png", await png(markSvg(180, { pad: 0.16 }), 180));

  // ---- in-app tile, kept for the service worker's precache list ----
  out("public/brand/mark-128.png", await png(markSvg(128, { pad: 0.08 }), 128));
  out("public/brand/mark-512.png", await png(markSvg(512, { pad: 0.08 }), 512));

  // ---- favicon ----
  const sizes = [16, 32, 48];
  const frames = [];
  for (const size of sizes) {
    frames.push({ size, data: await png(markSvg(size, { pad: 0.06 }), size) });
  }
  out("app/favicon.ico", ico(frames));

  console.log(
    "\nThe social card is app/opengraph-image.tsx — generated per request, not here,\nbecause it sets the wordmark and needs the real font."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
