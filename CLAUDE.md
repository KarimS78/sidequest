@AGENTS.md

# SideQuest AI

Companion gaming intelligent — "Never forget where you left off." Détecte/journalise les sessions de jeu et génère des résumés de progression par IA pour qu'un joueur reprenne n'importe quel jeu là où il s'est arrêté.

## Décisions produit (V1)
- **Périmètre** : web d'abord, agent desktop léger prévu en étape ultérieure.
- **Steam** : import via SteamID64 manuel (pas d'OAuth), fetch library + playtime via Steam Web API côté serveur.
- **Langue de l'app** : anglais (cible recruteurs remote).
- **Accès** : démo publique ("Try the demo", compte pré-rempli) + auth Supabase optionnelle.
- **Screenshots** : jamais stockés — envoyés à l'API vision en mémoire, on garde seulement le résumé.

## Stack
- Next.js 16 (App Router, Server Actions) — **lire `node_modules/next/dist/docs/` avant d'écrire du code Next** (breaking changes v16).
- Tailwind v4 (`@theme inline` dans `app/globals.css`).
- Supabase (Postgres + Auth + RLS) — pas encore branché, V1 tourne sur `lib/seed.ts`.
- IA : Claude (vision + texte) côté serveur, clé jamais exposée.
- Déploiement : Vercel + Supabase (plans gratuits).

## Design system
Dark-first. Fond `#0a0a0b`, surfaces `#141416`, bordures `#232326`, accent violet `#7c5cff`. Typo Geist Sans + Geist Mono. Style Linear (densité/typo) + Steam (covers). Tokens dans `app/globals.css`.

## Structure actuelle
- `app/page.tsx` — landing
- `app/dashboard/` — Library
- `app/games/[id]/` — fiche jeu + Resume My Game + timeline sessions
- `app/profile/` — stats + "What to play this weekend" (recommander)
- `components/` — nav, game-bits, recommender
- `lib/seed.ts` — données fictives (à remplacer par Supabase)
- **PWA** : `app/manifest.ts` (manifest), `public/sw.js` (service worker écrit à la main — pas de next-pwa/workbox), `components/sw-register.tsx` (enregistrement en prod uniquement), `components/install-prompt.tsx`, `app/offline/page.tsx`, icônes générées par `scripts/generate-icons.mjs`.

## Conventions
- Français casual avec Karim. App en anglais.
- Workflow : dev/preview d'abord, jamais merger en main sans validation explicite.
