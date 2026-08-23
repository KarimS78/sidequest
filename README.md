# SideQuest 🎮

> **Never forget where you left off.**
> You own 150 games and have one free hour, so you scroll, you stall, you launch
> nothing. SideQuest reads your library and your mood, then picks the one game to
> play right now — and tells you why.

🔗 Try the demo: a sample library is pre-loaded, no signup and no API key required.

## Features

- **Steam library import** — your games, playtime and recent activity, via your SteamID64.
- **The picker** — tell it your time and your mood, get one game plus two backups.
- **Explainable picks** — every recommendation shows the reasons it scored on:
  the tag that matched your mood, the session length, the 9h you put in last week,
  the game you never launched.
- **Session history** — every pick logged, so it stops suggesting the same three games.
- **Roast mode** — a playful read of your backlog, built from your real numbers.
- **Profile & stats** — favourite genres, hidden games, hours at a glance.
- **Installable PWA** — works offline, installs to your phone or desktop.
- **Desktop overlay** *(in progress)* — a lightweight Electron overlay that runs alongside your games.

## How the recommendation works

No model, no API call, no black box. `lib/recommend.ts` scores every game in your
library as a sum of named components:

| Component | Weight | Signal |
| --- | --- | --- |
| Mood match | 0–40 | Community tags vs. the mood you picked (or typed) |
| Session fit | −12–20 | Short-burst vs. sprawling tags vs. the time you have |
| Momentum | 0–15 | Hours in the last 2 weeks — you're mid-run |
| Rediscovery | 0–15 | Never launched, or barely touched and long dormant |
| Taste | 0–10 | Your profile's favourite genres |
| Anti-repetition | −25 | Recommended to you recently |

The top five then go into a weighted draw, so a clear winner usually wins but the
spin stays a spin. The badges on the pick card are generated from the components
that actually scored — the explanation can't drift from the maths.

Tags come from [SteamSpy](https://steamspy.com), falling back to the Steam
storefront's genres and categories. Both are keyless public endpoints.

## Tech stack

- **Web:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4
- **Recommendations:** local scoring engine — pure TypeScript, no network, no dependencies
- **Backend / data:** localStorage today, Supabase (PostgreSQL, Auth, RLS) next
- **PWA:** hand-written service worker, no next-pwa / workbox
- **Desktop:** Electron overlay
- **Deploy:** Vercel

## Getting started

```bash
npm install
npm run dev                  # http://localhost:3000
```

That's it — the picker, the roast and the history all run on a sample library out
of the box.

To import your **real** Steam library, add a Steam Web API key:

```bash
cp .env.example .env.local   # then fill in STEAM_API_KEY
```

Without it, `/connect` runs in demo mode with sample data. No other key is needed.

### Desktop overlay

```bash
cd desktop
npm install
npm start
```

## Project structure

```
app/          Routes — play (picker), connect (Steam), dashboard, history, profile, roast
components/   UI — picker, roast, steam-connect, tag-enricher, ...
lib/          recommend (engine), roast, steam, library + history (persistence)
desktop/      Electron desktop overlay
public/       Static assets, service worker, PWA icons
```

## Status

V1, work in progress — built by [Karim](https://github.com/KarimS78).
Web-first, with the desktop overlay rolling out next.

## License

All rights reserved.
