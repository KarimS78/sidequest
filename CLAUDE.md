@AGENTS.md

# SideQuest

Companion gaming — "Never forget where you left off." Répond à « je joue à quoi, là, maintenant ? » en croisant la librairie Steam du joueur, son temps dispo et son humeur.

## Décisions produit (V1)
- **Périmètre** : web d'abord, agent desktop léger prévu en étape ultérieure.
- **Steam** : import via SteamID64 manuel (pas d'OAuth), fetch library + playtime via Steam Web API côté serveur.
- **IA optionnelle, et bornée** : le moteur local reste la base et le repli. L'IA (Gemini, clé de Karim) vient par-dessus sur trois points — choix du pick dans la shortlist, phrase de justification, roast, et résumé des notes de session. Sans `GEMINI_API_KEY`, tout fonctionne en local. **Toute dépense passe par `lib/ai-guard.ts`** : jamais plus de 12 candidats dans un prompt, texte libre tronqué, plafond de tokens en sortie par type d'appel, quotas jour par appareil et global, budget de tokens compté sur l'`usageMetadata` réel du provider, cache de réponses. Un garde-fou qui saute ne produit jamais d'erreur visible : ça dégrade vers le local.
- **Langue de l'app** : anglais (cible recruteurs remote).
- **Accès** : démo publique (SAMPLE_LIBRARY, aucun compte requis) + auth Supabase optionnelle.

## Stack
- Next.js 16 (App Router, Server Actions) — **lire `node_modules/next/dist/docs/` avant d'écrire du code Next** (breaking changes v16).
- Tailwind v4 (`@theme inline` dans `app/globals.css`).
- Supabase (Postgres + Auth + RLS) — pas encore branché, V1 persiste dans localStorage derrière `lib/library.ts` / `lib/history.ts`.
- **Moteur de reco** : `lib/recommend.ts`, TypeScript pur, zéro réseau, zéro dépendance. Score = somme de composantes nommées (mood/tags, durée de session, momentum, redécouverte du backlog, goûts du profil, anti-répétition), puis tirage pondéré dans le top 5 pour garder la surprise du spin. Tourne **côté client** — pas de secret, donc pas de Server Action.
- **Tags** : SteamSpy (tags communautaires), fallback genres + catégories du store Steam. Endpoints publics sans clé, throttlés à 250ms, appelés par lots depuis `components/tag-enricher.tsx`.
- Déploiement : Vercel + Supabase (plans gratuits).

## Design system — « l'étagère »
Le backlog est une **collection d'objets physiques**, et l'UI en est une : coques moulées, étiquettes sérigraphiées, tranches sur une étagère. Tirer un jeu sort une cartouche du rang (le trou reste visible) et l'encliquette dans le lecteur.

- **Palette** : fond `#191412` (brun-charbon chaud, jamais un noir bureautique), plateau `#241c18`, plastique `#b9b0a0` / crème `#e0d4bc`, étiquette `#f2ede1`, encre `#211c19`, contacts dorés `#c9a227`. Une couleur par humeur, imprimée sur le bandeau de l'étiquette et sur les tranches : story `#2f6fb3`, chill `#3e8e8a`, challenge `#c8432e`, quick `#d9a441`.
- **Typo** : Big Shoulders (étiquettes, titres, condensé industriel) + Geist (corps) + Geist Mono (données, petites capitales).
- **Mouvement — la règle qui tient la direction** : rien ne rebondit. Pas de ressort, pas de confetti. `--ease` pour les déplacements, `--seat` (`cubic-bezier(.85,0,.9,1)`) pour ce qui s'encliquette. Le pull fait quatre temps : éjection → défilement 2500ms → assise 180ms → lecture 420ms, puis l'étiquette s'imprime par balayage (`.print`), jamais par fondu.
- **Layout** : mobile-first, une colonne `max-w-md` centrée même sur desktop (`.column`), bottom nav fixe à 4 onglets, `.has-nav` pour dégager la hauteur de la nav + safe area.
- Tokens et matières (`.cart`, `.spine`, `.deck-slot`) dans `app/globals.css`.

## Structure actuelle
- `app/page.tsx` — redirige vers `/play` : le Spin **est** l'écran d'accueil, il n'y a pas de landing
- `app/play/` — le deck (session + humeur → une cartouche)
- `app/dashboard/` — Shelf (grille de cartouches)
- `app/history/` — Saves (les pulls + les notes de session)
- `app/profile/` — Collector : stats, roast (étiquette d'avertissement), goûts, jeux bannis
- `app/roast/` — conservé comme lien direct ; le roast s'affiche surtout dans le profil
- `app/connect/` — import Steam (+ `actions.ts` : import, recherche store, enrichissement des tags)
- `components/` — picker, roast, steam-connect, tag-enricher, add-games, library-view, history-list, profile-editor, nav
- `lib/` — `recommend.ts` (moteur), `roast.ts` (punchlines), `ai.ts` + `ai-guard.ts` (couche IA et ses plafonds), `steam.ts` (API Steam + tags), `library.ts` + `history.ts` (persistance localStorage), `device.ts` (id navigateur pour répartir le quota)
- **PWA** : `app/manifest.ts` (manifest), `public/sw.js` (service worker écrit à la main — pas de next-pwa/workbox), `components/sw-register.tsx` (enregistrement en prod uniquement), `components/install-prompt.tsx`, `app/offline/page.tsx`, icônes générées par `scripts/generate-icons.mjs`.

## Dette connue
- Les compteurs de quota de `lib/ai-guard.ts` vivent en mémoire du module : sur un hébergeur serverless chaque instance a son propre compte et un déploiement les remet à zéro. C'est un frein, pas une comptabilité. À basculer sur Supabase quand la base arrive (un seul fichier à changer).
- `desktop/` (overlay Electron) a son propre appel Gemini dans `desktop/ai.js`, sans ces garde-fous, et partage la même `GEMINI_API_KEY`. À aligner sur `lib/ai-guard.ts` ou à débrancher.
- Le `<title>` et le manifeste disent encore « SideQuest AI » par endroits alors que le produit s'appelle SideQuest — à harmoniser.

## Conventions
- Français casual avec Karim. App en anglais.
- Workflow : dev/preview d'abord, jamais merger en main sans validation explicite.
