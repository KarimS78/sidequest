# SideQuest AI 🎮

> **Never forget where you left off.**
> An intelligent gaming companion that logs your sessions and generates AI
> progress summaries — so you can pick up any game right where you stopped.

SideQuest connects to your game library, keeps a timeline of your play sessions,
and uses AI to summarize *what you were doing* and *what's next* — so coming back
to a game after weeks away takes seconds, not a frustrating "wait, where was I?".

🔗 Try the demo: a public, pre-filled account is available — no signup required.

## Features

- **Steam library import** — bring in your games and playtime via your SteamID64.
- **Resume my game** — AI-generated progress summaries tell you exactly where you left off.
- **Session timeline** — every session logged, per game.
- **Smart recommender** — "What should I play this weekend?" based on your library and mood.
- **Profile & stats** — your gaming identity at a glance.
- **Roast mode** — a playful AI take on your gaming habits.
- **Desktop overlay** *(in progress)* — a lightweight Electron overlay that runs alongside your games.

> 🔒 **Privacy:** screenshots are never stored. They're sent to the vision model
> in memory and discarded — only the text summary is kept.

## Tech stack

- **Web:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4
- **Backend / data:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **AI:** vision + text models, called server-side (keys never exposed to the client)
- **Desktop:** Electron overlay
- **Deploy:** Vercel + Supabase

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + API keys
npm run dev                  # http://localhost:3000
```

### Desktop overlay

```bash
cd desktop
npm install
npm start
```

## Project structure

```
app/          Routes — connect (Steam), dashboard, play, history, profile, roast
components/   UI — picker, library-view, steam-connect, roast, ...
lib/          Shared logic & data
desktop/      Electron desktop overlay
public/       Static assets
```

## Status

V1, work in progress — built by [Karim](https://github.com/KarimS78).
Web-first, with the desktop overlay rolling out next.

## License

All rights reserved.
