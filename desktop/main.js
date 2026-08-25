const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
  nativeImage,
  shell,
} = require("electron");
const path = require("path");
const { loadEnv } = require("./env");
const { askOverlay } = require("./ai");
const { searchWiki } = require("./wiki");
const games = require("./games");
const settings = require("./settings");

const env = loadEnv();
const API_KEY = env.OPENAI_API_KEY || "";

let overlay = null;
let tray = null;
let currentGameId = null; // loaded from settings on ready

function currentProfile() {
  return games.byId(currentGameId) || games.DEFAULT;
}

const EXPANDED = { width: 440, height: 560 };
const COLLAPSED = { width: 300, height: 56 };

// ----- Overlay window -----
function createOverlay() {
  overlay = new BrowserWindow({
    width: EXPANDED.width,
    height: EXPANDED.height,
    frame: false,
    transparent: true,
    resizable: true, // required so setBounds() can actually shrink the window
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 'screen-saver' level keeps it above borderless-windowed games.
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, "overlay.html"));

  overlay.on("closed", () => (overlay = null));
}

let isCollapsed = false;

// Resize + reposition the overlay together, anchored to the top-right corner.
function applyBounds() {
  if (!overlay) return;
  const size = isCollapsed ? COLLAPSED : EXPANDED;
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  overlay.setBounds({
    x: x + width - size.width - 24,
    y: y + 24,
    width: size.width,
    height: size.height,
  });
}

function showOverlay() {
  if (!overlay) createOverlay();
  applyBounds();
  overlay.showInactive(); // don't steal focus yet (so the screen grab is clean)
  overlay.setAlwaysOnTop(true, "screen-saver");
}

// ----- Screen capture (primary display, downscaled for the vision API) -----
async function captureScreenBase64() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const scale = display.scaleFactor || 1;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
  });
  const source =
    sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source) throw new Error("No screen source available.");

  let img = source.thumbnail;
  const sz = img.getSize();
  const max = 1280;
  const f = Math.min(1, max / Math.max(sz.width, sz.height));
  if (f < 1) {
    img = img.resize({
      width: Math.round(sz.width * f),
      height: Math.round(sz.height * f),
    });
  }
  return img.toJPEG(80).toString("base64");
}

// ----- The help flow: ground on the wiki -> capture -> ask OpenAI -> render -----
async function runHelp(question) {
  showOverlay();
  const profile = currentProfile();
  overlay.webContents.send("loading", { question: question || "", game: profile.name });
  try {
    // Wiki grounding only makes sense when there's a question to search for.
    let wikiContext = "";
    let sources = [];
    if (profile.wiki && question) {
      try {
        const r = await searchWiki(profile.wiki, question);
        wikiContext = r.text;
        sources = r.sources;
      } catch {
        /* grounding is best-effort; fall back to the model alone */
      }
    }

    const imageBase64 = await captureScreenBase64();
    const result = await askOverlay({
      apiKey: API_KEY,
      question,
      imageBase64,
      profile,
      wikiContext,
    });
    if (currentGameId) result.game = profile.name; // we know the game for sure
    result.sources = sources;
    if (overlay) overlay.webContents.send("result", result);
  } catch (e) {
    if (overlay) overlay.webContents.send("error", String(e.message || e));
  }
}

// ----- IPC from the overlay renderer -----
ipcMain.handle("ask", async (_e, question) => {
  await runHelp(question);
});
ipcMain.on("focus-overlay", () => {
  if (overlay) overlay.focus(); // user wants to type → give it focus
});
ipcMain.on("hide-overlay", () => {
  if (overlay) overlay.hide();
});
ipcMain.on("set-collapsed", (_e, collapsed) => {
  if (!overlay) return;
  isCollapsed = collapsed;
  applyBounds(); // shrink/grow the actual window + keep it top-right
});
ipcMain.handle("get-games", () => ({
  games: games.list(),
  currentId: currentGameId,
}));
ipcMain.handle("set-game", (_e, id) => {
  currentGameId = games.byId(id) ? id : null;
  settings.set("gameId", currentGameId);
  return currentProfile().name;
});

// ----- Tray -----
function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "assets", "icon.png")
  );
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("SideQuest — Ctrl+Shift+H for help");
  const menu = Menu.buildFromTemplate([
    {
      label: API_KEY ? "✓ OpenAI key loaded" : "⚠ No OPENAI_API_KEY",
      enabled: false,
    },
    { type: "separator" },
    { label: "Get help now (Ctrl+Shift+H)", click: () => runHelp("") },
    {
      label: "Open dashboard (web)",
      click: () => shell.openExternal("http://localhost:3001/dashboard"),
    },
    { type: "separator" },
    { label: "Quit SideQuest", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => runHelp(""));
}

app.whenReady().then(() => {
  currentGameId = settings.get("gameId", null);
  createOverlay();
  createTray();

  // Bind 1: instant "where am I / what next" (no typed question).
  globalShortcut.register("CommandOrControl+Shift+H", () => runHelp(""));
  // Bind 2: open overlay focused so the player can type a question.
  globalShortcut.register("CommandOrControl+Shift+J", () => {
    showOverlay();
    if (overlay) {
      overlay.focus();
      overlay.webContents.send("focus-input");
    }
  });
  // Bind 3: hide the overlay.
  globalShortcut.register("CommandOrControl+Shift+K", () => {
    if (overlay) overlay.hide();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
// Background app: don't quit when the overlay window is hidden/closed.
app.on("window-all-closed", () => {});
