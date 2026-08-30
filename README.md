# SideQuest 🎮

> **Never forget where you left off.**
> You own 150 games and have one free hour, so you scroll, you stall, you launch
> nothing. SideQuest reads your library and your mood, then picks the one game to
> play right now — and tells you why.

🔗 Try the demo: a sample library is pre-loaded, no signup and no API key required.
The app is bilingual — English and French are both first-class, switchable from
the header.

## Features

- **Steam library import** — your games, playtime and recent activity, via your SteamID64. No OAuth, no password.
- **The draw** — tell it your time and your mood (a button, or a typed sentence in either language), get one game plus two backups.
- **Explainable picks** — every recommendation shows the reasons it scored on:
  the tag that matched your mood, the session length, the 9h you put in last week,
  the game you never launched.
- **Saves** — every draw logged, grouped by game, with your own note of where you stopped and a one-line read-back when you come back weeks later.
- **The shelf** — your library, searchable by name or by a plain-language ask ("something short I don't have to think about").
- **Roast mode** — a playful read of your backlog, built from your real numbers.
- **Profile** — a portrait of what your shelf says about you, favourite genres, games it should never suggest, and the AI gauge in dollars.
- **Installable PWA** — works offline, installs to your phone or desktop.
- **Desktop overlay** *(in progress)* — a lightweight Electron overlay that runs alongside your games.

## How the recommendation works

The base is local. `lib/recommend.ts` scores every game in your library as a
sum of named components — pure TypeScript, no network, no dependencies, runs in
the browser:

| Component | Weight | Signal |
| --- | --- | --- |
| Mood match | 0–40 | Community tags vs. the mood you picked (or typed) |
| Session fit | −12–20 | Short-burst vs. sprawling tags vs. the time you have |
| Momentum | 0–15 | Hours in the last 2 weeks — you're mid-run |
| Rediscovery | 0–15 | Never launched, or barely touched and long dormant |
| Taste | 0–10 | Your profile's favourite genres |
| Anti-repetition | −25 | Recommended to you recently |

The top five then go into a weighted draw, so a clear winner usually wins but the
spin stays a spin. The badges on the verdict are generated from the components
that actually scored — the explanation can't drift from the maths.

A typed mood is read by a hand-written bilingual lexicon (`lib/mood-words.ts`):
senses like *calm*, *scary*, *hard*, *mindless*, the French and English words
that signal them, and the Steam tags they aim at. It folds accents, handles
negation per clause ("rien de trop dur" asks for the opposite of hard), and only
keeps a reading that lands on a tag your library actually has.

Tags come from [SteamSpy](https://steamspy.com), falling back to the Steam
storefront's genres and categories. Both are keyless public endpoints.

## The AI layer (optional, bounded)

With an `OPENAI_API_KEY`, `gpt-5-nano` sits on top of the local engine at seven
points: the pick sentence, the roast, the session note, the plain-language shelf
search, the shelf portrait, the note read-back, and the typed mood when the
lexicon doesn't recognise the words. Without the key, every feature still works
from the local engine and templates.

Every call goes through `lib/ai-guard.ts`: at most 12 candidates in a prompt,
free text clamped, output tokens capped per call type, daily quotas per device
and global, spend counted from the provider's real usage (input and output
separately — they are priced an order of magnitude apart), and a response cache.
A guard that trips never shows an error: it degrades to the local result. The
shelf search never sees your library — it receives the *vocabulary* of tags and
answers with a filter, applied on your device. The profile shows what today
cost, in dollars, and what a day at full quota would cost.

## Tech stack

- **Web:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4
- **Recommendations:** local scoring engine — pure TypeScript, no network, no dependencies
- **AI:** OpenAI `gpt-5-nano`, optional, behind `lib/ai-guard.ts`
- **i18n:** one typed dictionary per screen in `i18n/`, locale decided server-side from a cookie, owned by the client after
- **Design:** "Studio Nuit" — dark dashboard, Clash Display / Instrument Sans / Geist Mono, one violet that means "this is the answer"
- **Backend / data:** localStorage today, Supabase (PostgreSQL, Auth, RLS) next
- **PWA:** hand-written service worker, no next-pwa / workbox
- **Desktop:** Electron overlay
- **Deploy:** Vercel

## Getting started

```bash
npm install
npm run dev                  # http://localhost:3000
```

That's it — the draw, the roast and the saves all run on a sample library out
of the box.

To import your **real** Steam library, and optionally turn the AI layer on:

```bash
cp .env.example .env.local   # then fill in STEAM_API_KEY, and OPENAI_API_KEY if you want it
```

Without `STEAM_API_KEY`, `/connect` runs in demo mode with sample data. Without
`OPENAI_API_KEY`, everything runs on the local engine.

### Brand assets

`brand/logo-master.png` is the only source. Every icon, favicon and the social
card lockup are derived from it:

```bash
node scripts/generate-brand.mjs
```

### Screenshots

The PWA manifest's install-dialog screenshots are shot from the running app:

```bash
npm run build && npm start        # in one terminal
node scripts/screenshot.mjs       # in another; writes public/screenshots/
```

### Desktop overlay

```bash
cd desktop
npm install
npm start
```

## Project structure

```
app/          Routes — play (the draw), dashboard (shelf), history (saves), profile, connect, roast, offline
components/   UI — picker, library-view, history-list, profile-editor, portrait, roast, nav, motion, ...
lib/          recommend (engine), mood-words (lexicon), ai + ai-guard (AI layer), roast, steam, library + history
i18n/         One dictionary per screen, EN and FR, plus the server/client locale handover
brand/        The logo master
scripts/      generate-brand, screenshot, ai-smoke
assets/       Font and lockup used to render the social card
desktop/      Electron desktop overlay
public/       Static assets, fonts, service worker, PWA icons and screenshots
```

## Status

V1, work in progress — built by [Karim](https://github.com/KarimS78).
Web-first, with the desktop overlay rolling out next.

## License

All rights reserved.
