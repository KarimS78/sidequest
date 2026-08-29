/**
 * Screenshots of the running app, at sizes that are actually the sizes asked
 * for.
 *
 *   node scripts/screenshot.mjs [baseUrl] [outDir] [--all]
 *
 * Chrome's `--window-size` cannot go below roughly 500px on Windows, so
 * `--screenshot` at a phone width silently crops a desktop render instead of
 * rendering a phone. This drives the browser over the DevTools protocol and
 * sets the device metrics properly, which is also how the PWA manifest's
 * `wide` and `narrow` screenshots get their exact dimensions.
 *
 * Writes the two shots the manifest names:
 *   public/screenshots/desktop.png   1440x900   (form_factor: wide)
 *   public/screenshots/phone.png      780x1688  (form_factor: narrow)
 *
 * Pass --all to also shoot the other routes at both sizes — useful for
 * reviewing a change, but point it at a scratch directory: everything under
 * public/ ships with the app.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3]?.startsWith("--") ? "public/screenshots" : (process.argv[3] ?? "public/screenshots");
const PORT = 9333;

const CHROME =
  process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "google-chrome";

/** The two shapes the manifest promises, and the routes worth reviewing. */
const SIZES = [
  { name: "desktop", width: 1440, height: 900, scale: 1, mobile: false },
  // 390x844 at 2x — a phone screenshot the install dialog will accept.
  { name: "phone", width: 390, height: 844, scale: 2, mobile: true },
];
const ALL = process.argv.includes("--all");
const ROUTES = ALL ? ["/play", "/dashboard", "/history", "/profile"] : ["/play"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  const res = await fetch(`http://localhost:${PORT}/json/list`);
  return res.json();
}

/** A tiny promise-based CDP client — no dependency, Node's own WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  // A CDP error arrives as `{id, error}` with no `result`. Resolving that to
  // `undefined` is how a failed navigate turns into a blank screenshot instead
  // of a stack trace, so it throws.
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (d) =>
        d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolve(d.result)
      );
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { send, close: () => ws.close() };
}

/**
 * Its own profile directory, and this is not optional.
 *
 * Chrome launched against the default profile while you already have Chrome
 * open does not start a browser: it hands the arguments to the running
 * instance and exits. `--remote-debugging-port` goes with it, `Page.navigate`
 * comes back an error this client drops on the floor, and every shot below is
 * a picture of `about:blank` — no crash, no warning, just blank PNGs. A
 * throwaway `--user-data-dir` is what forces a real second instance.
 */
const PROFILE = mkdtempSync(join(tmpdir(), "sq-shot-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" }
);

try {
  await sleep(2500);
  const targets = await cdpTargets();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target — is Chrome installed at " + CHROME + "?");

  const { send, close } = await connect(page.webSocketDebuggerUrl);
  await send("Page.enable");
  mkdirSync(OUT, { recursive: true });

  for (const size of SIZES) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: size.scale,
      mobile: size.mobile,
    });

    for (const route of ROUTES) {
      await send("Page.navigate", { url: BASE + route });
      // Fonts, cover art and the label animation all want a beat.
      await sleep(2200);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      const slug = route.replace(/\//g, "") || "home";
      const file =
        route === "/play"
          ? join(OUT, `${size.name}.png`)
          : join(OUT, `${size.name}-${slug}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      console.log(`${file}  ${size.width}x${size.height}${size.scale > 1 ? ` @${size.scale}x` : ""}`);
    }
  }

  close();
} finally {
  chrome.kill();
  // Windows keeps the profile's files locked for a moment after the kill, and
  // a throw here would bury whatever actually went wrong above. It is in the
  // OS temp directory either way.
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {}
}
