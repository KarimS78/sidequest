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

## Notes

- Screenshots are downscaled and sent to OpenAI in-memory — never written to disk.
- Works on borderless-windowed games (Elden Ring, BG3, most single-player titles).
