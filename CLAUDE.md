@AGENTS.md

# SideQuest

Companion gaming — "Never forget where you left off." Répond à « je joue à quoi, là, maintenant ? » en croisant la librairie Steam du joueur, son temps dispo et son humeur.

## Décisions produit (V1)
- **Périmètre** : web d'abord, agent desktop léger prévu en étape ultérieure.
- **Steam** : import via SteamID64 manuel (pas d'OAuth), fetch library + playtime via Steam Web API côté serveur.
- **IA optionnelle, et bornée** : le moteur local reste la base et le repli. L'IA (OpenAI `gpt-5-nano`, clé de Karim) vient par-dessus sur **six points** (`CallKind` dans `lib/ai-guard.ts`) — `pick` (choix dans la shortlist + phrase), `roast`, `note` (résumé de session), `search` (recherche en langage naturel sur le Shelf), `portrait` (ce que l'étagère dit du joueur, sur le profil), `resume` (relecture des vieilles notes sur Saves). Sans `OPENAI_API_KEY`, tout fonctionne en local. **Toute dépense passe par `lib/ai-guard.ts`** : jamais plus de 12 candidats dans un prompt, texte libre tronqué, plafond de tokens en sortie par type d'appel, quotas jour par appareil et global, budget compté sur l'`usage` réel du provider (**entrée et sortie séparées**, elles sont facturées à un ordre de grandeur d'écart), cache de réponses. Un garde-fou qui saute ne produit jamais d'erreur visible : ça dégrade vers le local.
- **La recherche IA ne voit jamais la librairie.** Elle reçoit le *vocabulaire* de tags de l'étagère et répond par un **filtre** (`AiFilter`), appliqué côté client. Deux conséquences : le prompt coûte pareil pour 10 jeux et pour 900, et le modèle ne peut structurellement pas citer un jeu que le joueur ne possède pas.
- **Le coût est affiché en dollars**, pas seulement en tokens (`getAiStatus` → panneau AI supply du profil) : dépensé aujourd'hui, et ce que coûterait une journée à plein régime. Un budget en tokens n'est lisible que par celui qui a écrit le garde-fou.
- **Langue de l'app** : anglais (cible recruteurs remote).
- **Accès** : démo publique (SAMPLE_LIBRARY, aucun compte requis) + auth Supabase optionnelle.

## Stack
- Next.js 16 (App Router, Server Actions) — **lire `node_modules/next/dist/docs/` avant d'écrire du code Next** (breaking changes v16).
- Tailwind v4 (`@theme inline` dans `app/globals.css`).
- Supabase (Postgres + Auth + RLS) — pas encore branché, V1 persiste dans localStorage derrière `lib/library.ts` / `lib/history.ts`.
- **Moteur de reco** : `lib/recommend.ts`, TypeScript pur, zéro réseau, zéro dépendance. Score = somme de composantes nommées (mood/tags, durée de session, momentum, redécouverte du backlog, goûts du profil, anti-répétition), puis tirage pondéré dans le top 5 pour garder la surprise du spin. Tourne **côté client** — pas de secret, donc pas de Server Action.
- **Tags** : SteamSpy (tags communautaires), fallback genres + catégories du store Steam. Endpoints publics sans clé, throttlés à 250ms, appelés par lots depuis `components/tag-enricher.tsx`.
- Déploiement : Vercel + Supabase (plans gratuits).

## Design system — « le panneau de service »
Pas l'écran d'attract : l'arrière de la borne, la porte que l'exploitant ouvre, avec la carte dedans et les cartouches rangées dessus. Une **Neo Geo MVS** — la borne dont les jeux *sont* des cartouches — ce qui fait qu'un panneau de service et une étagère de carts sont ici le même objet.

Ce choix rapporte deux choses qu'une UI néon ne peut pas donner :
1. **La sobriété est native.** Un panneau de maintenance, c'est de la sérigraphie sur acier et un afficheur ambre. L'ambre veut dire SOUS TENSION et rien d'autre — quand il apparaît, on regarde.
2. **L'UI se raconte elle-même.** Une machine conçue pour être dépannée affiche quel canal est réglé, ce qui manque, et ce qui se passe ensuite. Ce n'est pas une couche ajoutée par-dessus la DA, c'est la DA.

- **Palette** : fond `#0d1114` (acier froid, jamais un brun), plaque `#161c20`, plastique de cart `#39424a`/`#232a30`, sérigraphie `#dfe6ea`, gris secondaire `#7c8b93`, puits CRT `#080c0e`, **ambre `#ffb020`**. Une LED par humeur : story `#4a8fd4`, chill `#34b3a0`, challenge `#e34a2f`, quick `#f0c020`.
- **Typo** : Geist Mono porte tout le chrome opérateur (numéros de canaux, valeurs, readout) ; Big Shoulders est réservé au **contenu** (titres d'écran, noms de jeux) ; Geist pour les rares phrases. C'est l'inversion des rôles par rapport à l'ancienne DA.
- **Les deux signatures** :
  - **Le rail de canaux** (`.chan`, `.seg`) — `01 SESSION` / `02 MOOD` / `03 DRAW`. La numérotation n'est pas décorative : 01 et 02 sont des entrées, 03 est la sortie, et chaque canal = un en-tête + son contrôle (l'interrupteur *est* le contrôle de 03). Les segments de 01 sont littéralement les heures dont tu disposes ; ceux de 03 défilent pendant le tirage.
  - **Le readout** (`.readout`) — la bande CRT encastrée, seul endroit de l'app qui parle en phrases, et qui finit **toujours** par la prochaine action. Si le readout devient vague, c'est un bug de l'écran. Les scanlines n'existent que là : partout ailleurs ce serait un déguisement.
- **Mouvement — la règle qui tient la direction** : rien ne rebondit. Pas de ressort, pas de confetti. `--ease` pour les déplacements, `--seat` (`cubic-bezier(.85,0,.9,1)`) pour ce qui s'encliquette. Le pull fait quatre temps : éjection → défilement 2500ms → assise 180ms → lecture 420ms, puis l'étiquette s'imprime par balayage (`.print`), jamais par fondu. Appuyer sur l'interrupteur fait défiler la fente dans le champ de vision : le panneau passe la main à la carte.
- **Layout** : mobile-first, une colonne `max-w-md` (`.column`), bottom nav fixe à 4 onglets, `.has-nav` pour la nav + safe area.
- **Desktop = `.bench`, trois vraies colonnes** (plaque de contrôle / carte / journal) à partir de `lg`, pas deux colonnes avec une bande restante — c'est ça qui faisait lire un 1440px comme un téléphone élargi. `.room` s'ouvre jusqu'à 100rem en 2xl. La colonne de droite porte *à la fois* « how the board runs », « where you left off » et la plaque de specs du moteur de score : une colonne à moitié vide était la vraie cause du problème, pas la largeur.
- **Marquages sérigraphiés** (`.legend`, composant `Legend`) : la bande de légendes sous les plaques. Le `SERVICE CODE ↑↑↓↓←→←→BA` n'est pas décoratif — ce sont les touches que `components/eggs.tsx` écoute vraiment, donc l'indice et la réponse au même endroit, imprimés là où un indice s'imprime sur une machine.
- **Le rack** (`.rack`, `.spine`) : largeur dérivée du nombre de cartouches (`--rack-max`), jamais `fit-content` — un conteneur flex en `fit-content` retombe sur sa taille min-content et écrasait un rack de dix en 116px. Un rack qui ne remplit pas la largeur n'est pas un bug de layout : c'est un rack où il reste de la place.
- **Les trois animations, et pas une de plus** : `.post` (power-on self test — les canaux montent 01, 02, 03 puis le readout, une seule fois au montage, par balayage jamais par fondu) ; le readout qui **s'imprime caractère par caractère** (`useTyped`, la ligne entière reste dans le DOM en `sr-only` pour les lecteurs d'écran) ; `.rack-live` (pendant le scan une lumière parcourt le rack, décalée par `--i`, sinon la bobine tourne dans un coin et le rack est mort à côté). Plus les scanlines qui dérivent dans le readout. Tout respecte `prefers-reduced-motion`.
- **Vocabulaire** : on *run* un *draw*, une cartouche s'*assied* (seated), les jeux sont *racked*. L'onglet de tirage s'appelle DRAW comme l'interrupteur et comme le canal 03 — un mot par action, jamais deux.
- Tokens et matières (`.plate`, `.panel`, `.key`, `.switch`, `.led`, `.cart`, `.spine`, `.deck-slot`) dans `app/globals.css`.

## Structure actuelle
- `app/page.tsx` — **la landing** (depuis le 28/08/2026). Avant, elle redirigeait vers `/play` au motif que le produit s'explique en s'ouvrant : vrai pour qui sait déjà ce qu'est SideQuest, faux pour tout le monde d'autre, qui tombait sur des canaux numérotés sans savoir ce qu'était un *draw*. Même langage visuel que l'app (plaques, canaux, readout), pas un tour de captures d'écran. **Les chiffres imprimés dessus sont importés du code qui les applique** (`LIMITS`, `PRICE_PER_MTOK`, `SAMPLE_LIBRARY.length`) — une landing qui cite un plafond que le code n'honore plus est pire qu'une landing qui n'en cite aucun. Sections : hero + maquette de board inerte, ce qui se passe vraiment, 01/02/03, la plaque de score, la couche IA + son coût, la grille tarifaire, ce qu'il faut pour s'en servir.
- **Pas de nav sur la landing** : `BottomNav` retourne `null` sur `/`, et le décalage desktop est conditionné en CSS à l'existence du rail (`.app-shell:has(.rail)`) — une seule chose à changer, pas deux qui peuvent diverger.
- **Grille tarifaire** (Local board $0 / Powered $3 / Operator $6) : rien n'est facturé, il n'y a aucun formulaire de carte dans l'app, et le readout sous la grille le dit noir sur blanc. Les prix décrivent ce que la couche coûterait, pas ce qu'elle coûte.
- `app/play/` — le deck (session + humeur → une cartouche)
- `app/dashboard/` — Shelf (grille de cartouches)
- `app/history/` — Saves (les pulls + les notes de session)
- `app/profile/` — Collector : stats, roast (étiquette d'avertissement), goûts, jeux bannis, jauge de conso IA (+ `actions.ts` : `getAiStatus`)
- `app/roast/` — conservé comme lien direct ; le roast s'affiche surtout dans le profil
- `app/connect/` — import Steam (+ `actions.ts` : import, recherche store, enrichissement des tags)
- `components/` — picker, roast, steam-connect, tag-enricher, add-games, library-view (+ recherche IA), history-list (+ read-back), profile-editor, portrait, ai-status, nav
- `lib/` — `recommend.ts` (moteur), `roast.ts` (punchlines), `ai.ts` + `ai-guard.ts` (couche IA et ses plafonds), `steam.ts` (API Steam + tags), `library.ts` + `history.ts` (persistance localStorage), `device.ts` (id navigateur pour répartir le quota)
- **PWA** : `app/manifest.ts` (manifest), `public/sw.js` (service worker écrit à la main — pas de next-pwa/workbox), `components/sw-register.tsx` (enregistrement en prod uniquement), `components/install-prompt.tsx`, `app/offline/page.tsx`, icônes générées par `scripts/generate-icons.mjs`.

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
- Le `<title>` et le manifeste disent encore « SideQuest AI » par endroits alors que le produit s'appelle SideQuest — à harmoniser.

## Conventions
- Français casual avec Karim. App en anglais.
- Workflow : dev/preview d'abord, jamais merger en main sans validation explicite.
