/**
 * Generates the PWA icon set into public/ — no external dependency.
 *
 * Draws the SideQuest mark (the accent "S" chip from components/nav.tsx) on the
 * app background, rasterized with 4x supersampling and encoded as PNG by hand.
 *
 *   node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Design tokens — app/globals.css
const BG = [10, 10, 11]; // --bg #0a0a0b
const GRAD_FROM = [157, 134, 255]; // --accent-soft #9d86ff
const GRAD_TO = [106, 69, 240]; // deeper end of --accent #7c5cff
const GLOW = [124, 92, 255]; // --accent

// ---------------------------------------------------------------- PNG encoder

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** @param {Uint8Array} rgba  @param {boolean} opaque drop the alpha channel */
function encodePng(rgba, size, opaque) {
  const channels = opaque ? 3 : 4;
  const raw = Buffer.alloc(size * (size * channels + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[o++] = rgba[i];
      raw[o++] = rgba[i + 1];
      raw[o++] = rgba[i + 2];
      if (!opaque) raw[o++] = rgba[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // colour type: RGB / RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ rasterizer

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** signed distance to a rounded box centred on the origin */
function sdRoundedBox(px, py, half, r) {
  const qx = Math.abs(px) - half + r;
  const qy = Math.abs(py) - half + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return Math.min(Math.max(qx, qy), 0) + outside - r;
}

/** normalised angle in [0, TAU) */
const angle = (x, y) => {
  const a = Math.atan2(y, x);
  return a < 0 ? a + TAU : a;
};

const deg = (d) => (d * Math.PI) / 180;

/**
 * Distance to the "S" skeleton: two tangent circle arcs meeting at the origin.
 * Upper bowl opens toward the lower-right, lower bowl toward the upper-left.
 */
function distanceToS(px, py, R) {
  let best = Infinity;

  // upper bowl — centre (0, R), gap between 270° and 340°
  {
    const vx = px - 0;
    const vy = py - R;
    const a = angle(vx, vy);
    if (!(a > deg(270) && a < deg(340))) best = Math.abs(Math.hypot(vx, vy) - R);
    // round cap at the top-right terminal
    const ex = R * Math.cos(deg(340));
    const ey = R + R * Math.sin(deg(340));
    best = Math.min(best, Math.hypot(px - ex, py - ey));
  }

  // lower bowl — centre (0, -R), gap between 90° and 160°
  {
    const vx = px - 0;
    const vy = py + R;
    const a = angle(vx, vy);
    if (!(a > deg(90) && a < deg(160))) best = Math.min(best, Math.abs(Math.hypot(vx, vy) - R));
    // round cap at the bottom-left terminal
    const ex = R * Math.cos(deg(160));
    const ey = -R + R * Math.sin(deg(160));
    best = Math.min(best, Math.hypot(px - ex, py - ey));
  }

  return best;
}

/**
 * @param {number} size      output size in px
 * @param {number} chipFrac  chip side as a fraction of `size`
 * @param {boolean} opaque   flatten onto the background (no alpha channel)
 */
function renderIcon(size, chipFrac, opaque) {
  const SS = 4; // supersampling factor per axis
  const out = new Uint8Array(size * size * 4);

  const chip = size * chipFrac;
  const half = chip / 2;
  const radius = chip * 0.28;
  const glowRadius = size * 0.62;

  // "S" metrics, relative to the chip
  const R = chip * 0.115; // bowl radius
  const strokeHalf = (chip * 0.1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // centred coordinates, y up
          const px = x + (sx + 0.5) / SS - size / 2;
          const py = size / 2 - (y + (sy + 0.5) / SS);

          let cr = BG[0];
          let cg = BG[1];
          let cb = BG[2];
          let ca = 1;

          // ambient glow behind the chip
          const gl = clamp01(1 - Math.hypot(px, py) / glowRadius);
          const ga = 0.3 * gl * gl;
          cr = lerp(cr, GLOW[0], ga);
          cg = lerp(cg, GLOW[1], ga);
          cb = lerp(cb, GLOW[2], ga);

          // chip
          if (sdRoundedBox(px, py, half, radius) <= 0) {
            const t = clamp01((px + half + (half - py)) / (2 * chip));
            cr = lerp(GRAD_FROM[0], GRAD_TO[0], t);
            cg = lerp(GRAD_FROM[1], GRAD_TO[1], t);
            cb = lerp(GRAD_FROM[2], GRAD_TO[2], t);
            ca = 1;

            // the mark
            if (distanceToS(px, py, R) <= strokeHalf) {
              cr = 255;
              cg = 255;
              cb = 255;
            }
          }

          r += cr;
          g += cg;
          b += cb;
          a += ca;
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
      out[i + 3] = opaque ? 255 : Math.round((a / n) * 255);
    }
  }

  return out;
}

// ----------------------------------------------------------------------- build

const TARGETS = [
  // maskable safe zone: the mark must sit inside the centred 80%
  { file: "icon-192.png", size: 192, chipFrac: 0.7, opaque: false },
  { file: "icon-512.png", size: 512, chipFrac: 0.7, opaque: false },
  { file: "icon-maskable-512.png", size: 512, chipFrac: 0.56, opaque: false },
  // iOS ignores alpha — ship it flattened on #0a0a0b
  { file: "apple-touch-icon.png", size: 180, chipFrac: 0.68, opaque: true },
];

mkdirSync(PUBLIC_DIR, { recursive: true });
for (const { file, size, chipFrac, opaque } of TARGETS) {
  const png = encodePng(renderIcon(size, chipFrac, opaque), size, opaque);
  writeFileSync(join(PUBLIC_DIR, file), png);
  console.log(`${file.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
