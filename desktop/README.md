# SideQuest Desktop (Electron overlay)

In-game companion overlay for **single-player games**. Runs in the tray, listens
for global hotkeys, captures your screen, and asks OpenAI for help — shown in a
transparent always-on-top overlay.

## Requirements

- The web app's `../.env.local` must contain `OPENAI_API_KEY` (the desktop app
  reuses it automatically). Or put a `.env.local` here.
- Run your game in **borderless windowed** mode. Overlays cannot draw over
  *exclusive* fullscreen without DLL injection (risky / anti-cheat).

## Run

```bash
cd desktop
npm install        # first time only (downloads Electron)
npm run make-icon  # first time only (generates the tray icon)
npm start
```

## Hotkeys

| Bind | Action |
|------|--------|
| `Ctrl+Shift+H` | Capture the screen and get instant "where am I / what next" help |
| `Ctrl+Shift+J` | Open the overlay focused so you can type a question |
| `Ctrl+Shift+K` | Hide the overlay |

The tray icon (purple dot) has a menu: get help, open the web dashboard, quit.

## Spend

Every request goes through `guard.js`:

| Ceiling | Value |
| --- | --- |
| Minimum gap between calls | 1.5s — a held global hotkey auto-repeats on Windows |
| Calls per day | 120 (about $0.07 at nano rates) |
| Tokens per day | 250,000, counted on what OpenAI says it billed |
| Output per call | 1,200 tokens, reasoning included |
| Request timeout | 20s — vision plus a wiki lookup is slower than plain text |
| Cache | same screen and question within 60s answers from memory |

Counters live in Electron's `settings.json`, so they survive a restart. A
refused call renders as a normal overlay answer rather than an error — you get
told why, mid-game, without a red box.

The numbers deliberately differ from the web app's `lib/ai-guard.ts`: those are
sized for a 350-token text prompt, and one overlay call carries a screenshot.

## Building an installer

```bash
cd desktop
npm install
npm run make-icon   # first time only
npm run dist
```

Writes to `desktop/dist/`: an NSIS installer on Windows, a dmg on macOS, an
AppImage on Linux. Unsigned — Windows SmartScreen and macOS Gatekeeper will
both warn on first run, which is the honest state of a personal project and
the reason the landing page says the overlay is not out yet rather than
offering a download.

The config lives in the `build` block of `package.json`. It has not been run
in CI, and no binary is published anywhere.

## Notes

- Screenshots are downscaled and sent to OpenAI in-memory — never written to disk.
- Works on borderless-windowed games (Elden Ring, BG3, most single-player titles).
