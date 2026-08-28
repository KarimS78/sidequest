@AGENTS.md

# SideQuest

Companion gaming — "Never forget where you left off." Répond à « je joue à quoi, là, maintenant ? » en croisant la librairie Steam du joueur, son temps dispo et son humeur.

## Décisions produit (V1)
- **Périmètre** : web d'abord, agent desktop léger prévu en étape ultérieure.
- **Steam** : import via SteamID64 manuel (pas d'OAuth), fetch library + playtime via Steam Web API côté serveur.
- **IA optionnelle, et bornée** : le moteur local reste la base et le repli. L'IA (OpenAI `gpt-5-nano`, clé de Karim) vient par-dessus sur **six points** (`CallKind` dans `lib/ai-guard.ts`) — `pick` (choix dans la shortlist + phrase), `roast`, `note` (résumé de session), `search` (recherche en langage naturel sur le Shelf), `portrait` (ce que l'étagère dit du joueur, sur le profil), `resume` (relecture des vieilles notes sur Saves). Sans `OPENAI_API_KEY`, tout fonctionne en local. **Toute dépense passe par `lib/ai-guard.ts`** : jamais plus de 12 candidats dans un prompt, texte libre tronqué, plafond de tokens en sortie par type d'appel, quotas jour par appareil et global, budget compté sur l'`usage` réel du provider (**entrée et sortie séparées**, elles sont facturées à un ordre de grandeur d'écart), cache de réponses. Un garde-fou qui saute ne produit jamais d'erreur visible : ça dégrade vers le local.
- **La recherche IA ne voit jamais la librairie.** Elle reçoit le *vocabulaire* de tags de l'étagère et répond par un **filtre** (`AiFilter`), appliqué côté client. Deux conséquences : le prompt coûte pareil pour 10 jeux et pour 900, et le modèle ne peut structurellement pas citer un jeu que le joueur ne possède pas.
- **Le coût est affiché en dollars**, pas seulement en tokens (`getAiStatus` → panneau AI supply du profil) : dépensé aujourd'hui, et ce que coûterait une journée à plein régime. Un budget en tokens n'est lisible que par celui qui a écrit le garde-fou.
- **Langue de l'app** : bilingue FR/EN, les deux de premier rang (voir la section dédiée). Avant le 29/08/2026 c'était anglais seul.
- **Accès** : démo publique (SAMPLE_LIBRARY, aucun compte requis) + auth Supabase optionnelle.

## Stack
- Next.js 16 (App Router, Server Actions) — **lire `node_modules/next/dist/docs/` avant d'écrire du code Next** (breaking changes v16).
- Tailwind v4 (`@theme inline` dans `app/globals.css`).
- Supabase (Postgres + Auth + RLS) — pas encore branché, V1 persiste dans localStorage derrière `lib/library.ts` / `lib/history.ts`.
- **Moteur de reco** : `lib/recommend.ts`, TypeScript pur, zéro réseau, zéro dépendance. Score = somme de composantes nommées (mood/tags, durée de session, momentum, redécouverte du backlog, goûts du profil, anti-répétition), puis tirage pondéré dans le top 5 pour garder la surprise du spin. Tourne **côté client** — pas de secret, donc pas de Server Action.
- **Tags** : SteamSpy (tags communautaires), fallback genres + catégories du store Steam. Endpoints publics sans clé, throttlés à 250ms, appelés par lots depuis `components/tag-enricher.tsx`.
- Déploiement : Vercel + Supabase (plans gratuits).

## Design system — « Studio Nuit » (depuis le 29/08/2026)

La métaphore console rétro / cartouches est **abandonnée**. Ce qui la remplace : un tableau de bord sombre, dense mais calme, avec un titrage affiche et un **verdict cinématique plein cadre sur l'art du jeu**. Le ton des textes est gamer complice, jamais corporate.

Deux règles tiennent tout le reste :
1. **Un seul violet, et il veut dire « c'est ça, la réponse ».** La lueur (`--glow`) est dépensée sur exactement deux choses : le CTA primaire et la marque. Partout ailleurs c'est de l'acier et du type. Une lueur sur chaque carte, c'est du papier peint ; une lueur sur une seule chose, c'est un pointeur.
2. **Rien n'est plat.** Une page de `#0d1114` pur lit comme une div non peinte, donc le fond porte un **grain SVG à 3 %** (`body::after`, fixe) et chaque surface est un cran au-dessus. Pas de glassmorphism, pas de dégradé violet pleine page : une seule flaque radiale derrière le hero, et rien d'autre.

- **Palette** : `--background #0d1114` · `--surface #141922` · `--surface-2 #0b0e13` · `--border #242c3a` / `--border-strong #2c3442` · `--foreground #e8ecf4` · `--muted #99a3b3` · `--subtle #6d7686` · `--accent #7c5cff` / `--accent-soft #a794ff` / `--accent-dim rgba(124,92,255,.14)`. Les états (joué, banni) sont en gris/blanc — **jamais de vert ou de rouge criards**.
- **Typo, trois familles et pas une de plus** :
  - **Clash Display** (Fontshare, 500/600/700) porte les affiches : `<h1>`–`<h3>`, la classe `.poster`, le nom du jeu sur le verdict. **Auto-hébergée** dans `public/fonts/` via `next/font/local` — 45 Ko pour trois graisses, et surtout aucune requête CDN sur le premier titre que voit un visiteur.
  - **Instrument Sans** pour tout ce qui se lit.
  - **Geist Mono** pour tout ce que le moteur a calculé : un score, un compte d'heures, une durée de session. **Le mono est le signal que le chiffre vient du calcul.**
  - Interdits : Inter, Roboto, Arial, et le Space Mono par défaut de Tailwind.
- **`.poster` est en `line-height: 1.06`, pas 1.03.** C'est le seul chiffre du brief qui a bougé, et pour une raison : les capitales accentuées françaises (È, À, Ç) tapaient dans la ligne du dessus à 1.03. L'app est bilingue, donc c'est 1.06.
- **Rayons fixes**, aucune valeur intermédiaire : 8px boutons (`--r-btn`), 10px inputs (`--r-input`), 16px cartes (`--r-card`).
- **Focus visible partout** : `outline` 2px `--accent-soft`, offset 2px, sur `a, button, input, textarea, select, [tabindex]`.
- **La signature, c'est le panneau verdict** (`.verdict`, `.verdict-art`, `.verdict-scrim`, `.verdict-body`) : l'art large du jeu (`library_hero.jpg`) plein cadre, un scrim vertical vers le fond, et le contenu en bas. Au repos il montre **l'étagère du joueur** en mosaïque floutée sous le scrim — un panneau vide ne peut pas dire « c'est dans ta bibliothèque que ça va piocher ».
- **Mouvement** : uniquement `transform`/`opacity`, easing maison `--ease-out-quest: cubic-bezier(.22,1,.36,1)`, `--spring` pour ce qui s'assied, durées 180–520 ms, `prefers-reduced-motion` respecté globalement.
  - `.rise` — la cascade d'entrée, **une seule fois au montage**, décalée par `--i` (60 ms). Jamais re-déclenchée au scroll.
  - **Le tirage** (`components/picker.tsx`) : les jaquettes défilent en **décélérant** — 12 frames à 60 ms, 6 à 90, 4 à 140, 3 à 220 — avec `blur(6px)` + `skewY` sur la couche art. **C'est la décélération qui fait tout le travail** : un reel à cadence constante est un spinner, un reel qui ralentit est une décision en train de se prendre. Puis flash violet du cadre (`.is-seating`, une fois, 400 ms), le titre s'écrit lettre par lettre (`<Letters>`, 25 ms), la phrase, puis les scores **comptent de 0** (`useCountUp`).
  - `.deal-out` / `.deal-in` — « pas celui-là » : la carte sort par la gauche avec −2° de rotation, la suivante entre par la droite.
  - `.seg::before` (fond qui glisse) et `.chip::before` (remplissage qui se déroule depuis la gauche) : une sélection **se déplace**, elle ne change pas de couleur.
  - CTA magnétique (`useMagnetic`, 4 px max) et flèche qui part en avant au survol.
  - View Transitions natives entre les routes (`experimental.viewTransition` + `<ViewTransition default="page">` dans le layout) : fondu + 8 px. Sans support navigateur, coupe franche — c'est le bon repli.
- **Deux pièges de rendu, vérifiés** :
  - Un **`<mask>` SVG est rasterisé avant mise à l'échelle** : la première version de la marque rendait un octogone avec une lettre baveuse à 30px. La marque est donc tracée en direct (losange plein + « S » tracé dans la couleur du fond), et tient jusqu'à 18px.
  - Un dégradé qui finit sur `transparent` interpole vers du **noir transparent**. Et `radial-gradient(closest-side, …)` dans **satori** (l'OG image) troue le halo même avec des stops corrigés — d'où un dégradé linéaire sur la carte sociale.
- Tokens et utilitaires (`.wrap`, `.has-tabs`, `.card`, `.card-quiet`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-quiet`, `.seg`, `.chip`, `.badge`, `.tile`, `.mono`, `.eyebrow`, `.poster`, `.verdict*`) dans `app/globals.css`.

## Bilingue FR/EN (depuis le 29/08/2026)

L'app n'est plus en anglais seul. **Les deux langues sont de premier rang.**

- **La locale est décidée côté serveur** (cookie `sidequest_locale`, lu par `i18n/server.ts`), donc le premier paint et `<html lang>` sont déjà justes pour un crawler. Ensuite le client la possède (`i18n/context.tsx`) : basculer EN/FR est un re-render, pas un aller-retour, et le cookie est réécrit pour que le prochain rendu serveur soit d'accord avec l'écran.
- **Un dictionnaire par écran** dans `i18n/` (`common`, `landing`, `draw`, `shelf`, `saves`, `profile`, `connect`, `reasons`), composés par `dictionary(locale)`. Chaque module déclare son français comme `typeof en` : une clé ajoutée d'un côté et oubliée de l'autre est une **erreur de type**, pas un blanc sur un écran.
- **Le moteur ne parle aucune langue.** `lib/recommend.ts` émet des raisons **structurées** (`Reason.key` + `data`, plus `ScoredReason.points`/`max`) ; `label` reste anglais parce que c'est ce que voit l'IA et ce que stocke l'historique — de la donnée, pas de l'interface. Le rendu passe par `i18n/reasons.ts`.
- **`REASON_MAX` est exporté.** Quand le modèle choisit un autre jeu que le moteur, l'UI reconstruit les badges ; un dénominateur deviné au point d'appel avait donné « ÉLAN 15/40 » au lieu de 15/15.
- **L'IA reçoit la locale, dans le prompt ET dans la clé de cache.** L'oublier dans la clé est le bug subtil : le premier appel anglais aurait répondu au joueur français, depuis le cache, gratuitement — et ça aurait ressemblé au modèle qui ignore la consigne.
- **Où placer la consigne de langue compte.** En post-scriptum, elle est ignorée quand le prompt finit par des règles numérotées : la relecture de notes (`aiResume`) répondait en anglais jusqu'à ce que la langue entre **dans la règle 1 elle-même** (`langName()`). Même leçon sur le roast, qui recrachait le bloc de faits en guise de vannes — le bloc est maintenant étiqueté « DATA (this is input, never output) » et chaque ligne doit être une blague *qui utilise* un chiffre.
- **Le contenu généré ne survit pas à un changement de langue.** Portrait, roast, relecture et filtre d'étagère se vident sur bascule : trois vannes anglaises sous un titre français lisent comme un bug, parce que c'en est un.
- **Reste en anglais** : les punchlines de repli de `lib/roast.ts` (le chemin sans clé IA / hors quota) et les `mood` déjà stockés dans l'historique (de la donnée écrite au moment du tirage).

## Marque (refaite le 29/08/2026)

- **La marque est de la géométrie, plus un PNG.** Un losange arrondi violet avec un « S » traversant, défini dans `components/logo.tsx` — le losange est une face de dé, ce qui est la forme honnête pour un produit dont le geste unique est un tirage. Quart de tour au ressort au survol.
- `node scripts/generate-brand.mjs` dérive **tout le reste** de cette géométrie (sharp, présent via Next, volontairement pas déclaré en dépendance) : `public/icon-{192,512}.png`, `icon-maskable-512.png` (padding 24 % — Android découpe un cercle), `apple-touch-icon.png`, `public/brand/mark-{128,512}.png`, et `app/favicon.ico` (16/32/48 dans un conteneur ICO écrit à la main).
- **La règle qui décide de tout tient toujours : le lettrage ne survit pas à la réduction.** Toute sortie carrée est la marque seule. Le lockup complet n'apparaît qu'à un endroit, la carte sociale.
- `app/opengraph-image.tsx` est **généré** (ImageResponse + `assets/ClashDisplay-Semibold.ttf`), pas un PNG commité : il ne peut pas diverger de la marque. En anglais par défaut — un crawler n'envoie pas de cookie.
- `public/sw.js` précache `/` et les icônes → **bumper `CACHE` à chaque changement de logo ou de home** (fait : `sidequest-v4`).

## Structure actuelle

- `app/page.tsx` — **la landing**, cinq sections et pas une de plus : hero (+ une vraie carte verdict, pas une capture), le problème en trois lignes, les six composantes du score en badges, la grille tarifaire, le footer. Plus de numérotation 01/02/03, plus de service code, plus de prix en tokens.
- `app/play/` + `components/picker.tsx` — le Draw. Grille `380px / 1fr` : réglages à gauche, verdict cinématique à droite, alternatives dessous.
- `app/dashboard/` + `components/library-view.tsx` — l'Étagère. **Les deux recherches sont distinguées à l'écran** : taper filtre par nom, le bouton envoie la phrase au modèle, et le filtre obtenu est *montré* (tags, jamais lancés, durée de session) avant d'être appliqué.
- `app/history/` + `components/history-list.tsx` — les Reprises. **Groupées par jeu, pas par tirage** : « où j'en étais » est une question sur Hollow Knight, pas sur un mardi. Une carte par jeu, la note en évidence, la relecture IA en vrai bouton, les tirages repliés.
- `app/profile/` + `components/profile-editor.tsx` — le Profil, en **deux régions annoncées** : « ce qu'il en déduit » (portrait + roast, deux lectures des mêmes chiffres) et « ce que tu lui dis » (genres, jamais proposer). La jauge IA et la vitrine à trophées sont de l'intendance, en bas. La vitrine **démarre fermée** : douze lignes dont onze « verrouillé » étaient le plus gros bloc de la page.
- `app/connect/` — l'import Steam, `app/roast/` — le roast en lien direct, `app/offline/` — la carte hors-ligne.
- `components/motion.tsx` — `useCountUp`, `useMagnetic`, `<Letters>`, `prefersReducedMotion()`.
- **PWA** : `app/manifest.ts`, `public/sw.js` (écrit à la main), `components/sw-register.tsx`, `components/install-prompt.tsx`. Le bandeau d'installation est **en bas**, jamais en haut : la seule chose qu'un visiteur cherche dans la première seconde est le titre, et une barre par-dessus le header cache le produit pour en faire la publicité.

## Ce que les premiers appels réels ont appris (28/08/2026)
La clé a été branchée ce jour-là et les six points testés en vrai. Trois choses n'apparaissaient pas en lisant le code :

- **La recherche filtrait à l'envers.** Version initiale : un ET de toutes les clauses, relâché dans l'ordre quand ça rendait vide. Sur « something short I don't have to think about » le modèle a renvoyé `Casual, Relaxing` **et** `Open World, Story Rich`, l'ET n'a rien trouvé, le relâchement a lâché `sessionFit` en premier — et l'étagère a répondu Baldur's Gate 3 et Red Dead 2. Corrigé en séparant **dur** (`unplayedOnly`, `maxHours` : vérifiables, ils excluent) et **mou** (`sessionFit`, tags : des devinettes de sens, ils **classent**). `sessionFit` vaut deux tags, ce qui remonte Hades sans qu'il ait besoin d'être taggé Casual. Réponse actuelle : Hades, Stardew, Hollow Knight.
- **Les deux règles du read-back tirent l'une contre l'autre, et il faut les tenir ensemble.** Prompt trop lâche → il invente un lieu plausible (« in the derelict after the mission hub », que le joueur n'a jamais écrit). Prompt durci sur « n'invente rien » → il recopie la note mot pour mot, en avalant même le préfixe d'ancienneté de ma mise en forme de liste. Le prompt porte maintenant les deux exigences numérotées, et l'ancienneté est balisée `[written X ago]` avec la mention explicite que c'est une métadonnée.
- **Une jauge qui ne bouge pas quand on dépense est pire que pas de jauge.** `AiStatusPanel` ne chargeait qu'au montage : le portrait et le roast, sur le même écran, la laissaient sur le compte d'avant. D'où `lib/ai-events.ts`, un événement window à une ligne — délibérément pas un state partagé, personne n'a besoin de savoir *combien*, seulement que l'affichage est périmé. Le cross-page marchait déjà (remontage = refetch).
- **Ordres de grandeur constatés** : un appel `search` ≈ 460 tokens (400 in / 64 out), un `portrait` ≈ 435 (320/115), soit **~0,006 ¢ l'appel**. Une journée à plafond plein vaut ~5 ¢. `money()` dans `ai-status.tsx` descend à trois décimales de centime pour cette raison : deux décimales affichaient `0.00¢` après un appel réellement facturé.

## Pièges du dev local (vérifiés le 27/08/2026)
- **Turbopack rate les écritures sur `app/globals.css`** dans ce dossier (OneDrive) : le CSS servi reste une version en arrière et `✓ Compiled` ment. Un `touch` ne suffit pas. Ce qui marche : écrire le fichier **deux fois** (write + write 1,2s plus tard) ou redémarrer le serveur. Toujours vérifier avec `curl` sur le `.css` de `/_next/static/chunks/` avant de conclure qu'une règle ne marche pas.
- **`next dev` orphelin** : un vieux serveur peut tenir le port 3000 avec un watcher mort ; le nouveau bascule sur 3001 en silence et tu regardes l'ancien. Vérifier le PID dans le log de démarrage, `taskkill /PID <n> /F`.
- **Service worker sur `localhost:3000`** : `public/sw.js` ne s'enregistre qu'en prod, mais un `next start` passé laisse le SW installé sur l'origine — il resert le vieux HTML pendant que les chunks JS arrivent frais, ce qui bloque l'app sur son skeleton. Et l'origine est partagée avec les autres projets du même port (des caches `applabo-*` traînaient là). Désinscrire + vider `caches` avant de débugger un écran figé.

## Dette connue
- Les compteurs de quota de `lib/ai-guard.ts` vivent en mémoire du module : sur un hébergeur serverless chaque instance a son propre compte et un déploiement les remet à zéro. C'est un frein, pas une comptabilité. À basculer sur Supabase quand la base arrive (un seul fichier à changer).
- ~~`desktop/ai.js` sans garde-fous~~ — **fait le 27/08/2026** : `desktop/guard.js`. Volontairement *pas* le même module que `lib/ai-guard.ts` — les plafonds web sont calibrés pour un prompt texte de 350 tokens, un appel overlay porte une capture d'écran et vaut une vingtaine de ceux-là ; partager les chiffres voudrait dire que l'un des deux est faux. Ce qui est partagé c'est la forme : clamp de l'entrée, plafond de sortie, comptage sur l'`usage` réel, cache, et jamais de blocage. Le garde-fou de l'overlay fait deux choses de plus : un **écart minimum de 1,5s entre appels** (un raccourci global maintenu se répète tout seul sous Windows — c'était le vrai trou) et des compteurs **persistés** dans le settings.json d'Electron, donc ils survivent à un redémarrage.
- Les punchlines de repli de `lib/roast.ts` sont en anglais seulement : c'est le chemin sans clé IA ou hors quota, donc invisible en usage normal, mais c'est la dernière surface anglaise en mode FR.

## Conventions
- Français casual avec Karim. App bilingue FR/EN.
- Workflow : dev/preview d'abord, jamais merger en main sans validation explicite.
