import type { Locale } from "./locale";

// The landing. A mood dial in the hero, then four sections: why you need it,
// how it decides, what it would cost, and one last push to the demo.

const en = {
  nav: {
    problem: "The problem",
    how: "How it picks",
    pricing: "Pricing",
    play: "Play",
  },

  hero: {
    eyebrow: "Your Steam library · your time · your mood",
    title: ["Tonight,", "you play this."],
    lede: "It reads the games you already own, the hour you actually have and the mood you are actually in, then comes back with one game. Not a shortlist. One.",
    moodLabel: "Mood",
    timeLabel: "Time you have",
    moods: ["Twitchy", "Demanding", "Calm", "Short", "Exploring", "Cosy"],
    primary: "Start the demo",
    reroll: "Reroll",
    reassure: "No account · No install · Demo already loaded",
    // The card beside the dial is scored live from a demo shelf, in the page.
    tonight: "Tonight",
    score: "Score",
    notShortlist: "Not a shortlist. One.",
  },

  /** One line per demo game, keyed by its name. */
  verdicts: {
    Hades: "“Roguelike” is the mood you asked for. Twenty minutes in the last two weeks — you are mid-run.",
    "Hollow Knight": "A real evening ahead, and a map half uncovered. Time to dive back in.",
    "Stardew Valley": "You asked for calm. The farm is waiting exactly where you left it.",
    Celeste: "Half an hour, no more. One chapter, a few deaths, one summit.",
    "Slay the Spire": "One run fits your slot. And you left a promising deck behind.",
    "Outer Wilds": "Still in its wrapper after months. That is what a backlog is for.",
    "Dead Cells": "Nine hours in a fortnight. You are already in it — keep going.",
    "Portal 2": "Never finished. Two hours, a rested brain, and portals.",
  } as Record<string, string>,

  marquee: [
    "Steam library",
    "One verdict",
    "Transparent score",
    "Session history",
    "Installable",
    "No account",
    "Open source",
    "Weighted draw",
  ],

  problem: {
    eyebrow: "The evening you actually have",
    title: "You own the games. That is the problem.",
    lines: [
      "Twenty minutes of scrolling, and you launch the same thing as last week.",
      "The backlog you paid for is a wall of covers that only makes you feel guilty.",
      "You reopen a save from March with no idea what you were in the middle of.",
    ],
  },

  how: {
    title: "Six things it weighs, and it shows you all six.",
    lede: "The ranking is pure math: a sum of named components, and the badges on the verdict are printed from the numbers that actually scored.",
    // In engine order, so index i matches the i-th score of the verdict.
    items: [
      { max: 40, line: "The tags behind what you asked for, matched against everything you own." },
      { max: 20, line: "Half an hour is not an evening. Some games know the difference." },
      { max: 15, line: "Nine hours in the last fortnight means you are already in it." },
      { max: 10, line: "The one still in its wrapper gets a push. That is what a backlog is for." },
      { max: 10, line: "The genres you said you like, weighted well under the mood you just picked." },
      { max: 5, line: "It stops offering the same three games. That was the whole complaint." },
    ],
    closing:
      "The five best then go into a weighted draw, so a clear winner usually wins and a close call stays a genuine toss-up. With the AI layer on, the model writes the sentence, can read a mood you typed in your own words, and may pick another game from the engine's shortlist — never one from outside it.",
  },

  pricing: {
    eyebrow: "What it would cost",
    title: "Three ways to run it.",
    plans: [
      {
        name: "Local",
        price: "$0",
        per: "forever",
        line: "The engine, your library, your history. Runs in your browser, needs no account and no key.",
        features: ["The scoring engine", "Steam import", "Session history", "Installable as an app"],
        cta: "Start here",
      },
      {
        name: "Powered",
        price: "$3",
        per: "a month",
        line: "The AI layer over the top: the sentence on the verdict, the shelf portrait, session notes, and search in plain language.",
        features: ["Everything in Local", "Written verdicts", "Session read-back", "Plain-language shelf search"],
        cta: "Turn it on",
        featured: true,
      },
      {
        name: "Studio",
        price: "$6",
        per: "a month",
        line: "The desktop overlay, in game. Ask where you are and what to do next without alt-tabbing out.",
        features: ["Everything in Powered", "In-game overlay", "Screen-aware answers", "Global hotkeys"],
        cta: "Coming soon",
      },
    ],
    honesty:
      "Nothing is billed. There is no card form anywhere in this app — during the beta these prices describe what the layer would cost, not what it costs. The overlay exists in the repository and is not packaged for download yet.",

    /**
     * What THIS deployment can actually do, read from the server's env at
     * render time. A pricing grid that lists a feature the running site cannot
     * perform is the one kind of copy that is worth catching automatically.
     */
    status: {
      live: "Live here",
      off: "Off here",
      soon: "Not out yet",
    },
    noSteamKey:
      "This deployment has no Steam key, so the import loads a demo shelf instead of your account. Everything else in this column works.",
    noAiKey:
      "No model key on this deployment, so this column is switched off: every screen falls back to the local engine and phrases things from templates.",
  },

  cta: {
    title: "Never forget where you left off.",
    lede: "Import your library, tell it your mood and your time. One verdict, and you play.",
  },

  footer: {
    built: "Built by Karim Sehil",
    source: "Source on GitHub",
    tag: "A portfolio project · Tonight, you play this.",
  },
};

const fr: typeof en = {
  nav: {
    problem: "Le problème",
    how: "Comment il choisit",
    pricing: "Tarifs",
    play: "Jouer",
  },

  hero: {
    eyebrow: "Ta bibliothèque Steam · ton temps · ton humeur",
    title: ["Ce soir,", "tu joues à ça."],
    lede: "Il lit les jeux que tu possèdes déjà, l'heure que tu as vraiment devant toi et l'humeur dans laquelle tu es vraiment, puis il revient avec un jeu. Pas une liste. Un.",
    moodLabel: "Humeur",
    timeLabel: "Temps disponible",
    moods: ["Nerveux", "Exigeant", "Calme", "Court", "Exploration", "Cosy"],
    primary: "Lancer la démo",
    reroll: "Relancer",
    reassure: "Sans compte · Sans installation · Démo déjà chargée",
    tonight: "Ce soir",
    score: "Score",
    notShortlist: "Pas une liste. Un.",
  },

  verdicts: {
    Hades: "« Roguelike », exactement l'humeur demandée. Vingt minutes ces deux dernières semaines : tu es en pleine run.",
    "Hollow Knight": "Une vraie soirée devant toi, et une carte à moitié dévoilée. C'est le moment de replonger.",
    "Stardew Valley": "Tu voulais du calme. La ferme t'attend exactement là où tu l'as laissée.",
    Celeste: "Une demi-heure, pas plus. Un chapitre, quelques morts, un sommet.",
    "Slay the Spire": "Une run tient dans ton créneau. Et tu avais laissé un deck prometteur.",
    "Outer Wilds": "Encore sous blister depuis des mois. C'est à ça que sert un backlog.",
    "Dead Cells": "Neuf heures en quinze jours. Tu es déjà dedans, autant continuer.",
    "Portal 2": "Jamais fini. Deux heures, un cerveau reposé, et des portails.",
  },

  marquee: [
    "Bibliothèque Steam",
    "Un seul verdict",
    "Score transparent",
    "Historique de sessions",
    "Installable",
    "Sans compte",
    "Open source",
    "Tirage pondéré",
  ],

  problem: {
    eyebrow: "La soirée que tu as vraiment",
    title: "Tu as les jeux. C'est bien ça, le problème.",
    lines: [
      "Vingt minutes à scroller, et tu relances la même chose que la semaine dernière.",
      "Le backlog que tu as payé est un mur de jaquettes qui ne fait que te culpabiliser.",
      "Tu rouvres une sauvegarde de mars sans la moindre idée de ce que tu étais en train de faire.",
    ],
  },

  how: {
    title: "Six choses pesées, et les six sont affichées.",
    lede: "Le classement est un pur calcul : une somme de composantes nommées, et les badges du verdict sont imprimés à partir des chiffres qui ont réellement compté.",
    items: [
      { max: 40, line: "Les tags derrière ce que tu demandes, croisés avec tout ce que tu possèdes." },
      { max: 20, line: "Une demi-heure n'est pas une soirée. Certains jeux font la différence." },
      { max: 15, line: "Neuf heures ces quinze derniers jours, c'est que tu es déjà dedans." },
      { max: 10, line: "Celui encore sous blister remonte. C'est à ça que sert un backlog." },
      { max: 10, line: "Les genres que tu as cochés, loin derrière l'humeur du moment." },
      { max: 5, line: "Il arrête de proposer les trois mêmes jeux. C'était toute la plainte." },
    ],
    closing:
      "Les cinq meilleurs passent ensuite dans un tirage pondéré : un vainqueur net gagne le plus souvent, et un quasi-ex æquo reste un vrai pile ou face. Avec la couche IA, le modèle écrit la phrase, peut lire une humeur tapée avec tes mots, et peut retenir un autre jeu de la shortlist du moteur — jamais un jeu hors de cette liste.",
  },

  pricing: {
    eyebrow: "Ce que ça coûterait",
    title: "Trois façons de le faire tourner.",
    plans: [
      {
        name: "Local",
        price: "0 $",
        per: "pour toujours",
        line: "Le moteur, ta bibliothèque, ton historique. Tourne dans ton navigateur, sans compte et sans clé.",
        features: ["Le moteur de score", "Import Steam", "Historique des sessions", "Installable comme une app"],
        cta: "Commencer ici",
      },
      {
        name: "Powered",
        price: "3 $",
        per: "par mois",
        line: "La couche IA par-dessus : la phrase du verdict, le portrait de l'étagère, les notes de session, et la recherche en langage courant.",
        features: ["Tout Local", "Verdicts rédigés", "Relecture de session", "Recherche en langage courant"],
        cta: "L'activer",
        featured: true,
      },
      {
        name: "Studio",
        price: "6 $",
        per: "par mois",
        line: "L'overlay desktop, en jeu. Demande où tu en es et quoi faire ensuite sans quitter la partie.",
        features: ["Tout Powered", "Overlay en jeu", "Réponses qui voient l'écran", "Raccourcis globaux"],
        cta: "Bientôt",
      },
    ],
    honesty:
      "Rien n'est facturé. Il n'y a aucun formulaire de carte dans cette app : pendant la bêta, ces prix décrivent ce que la couche coûterait, pas ce qu'elle coûte. L'overlay existe dans le dépôt mais n'est pas encore empaqueté.",

    status: {
      live: "Actif ici",
      off: "Éteint ici",
      soon: "Pas encore sorti",
    },
    noSteamKey:
      "Ce déploiement n'a pas de clé Steam : l'import charge une étagère de démo au lieu de ton compte. Tout le reste de cette colonne fonctionne.",
    noAiKey:
      "Pas de clé modèle sur ce déploiement, donc cette colonne est éteinte : tous les écrans retombent sur le moteur local et formulent à partir de gabarits.",
  },

  cta: {
    title: "N'oublie plus jamais où tu en étais.",
    lede: "Importe ta bibliothèque, donne ton humeur et ton temps. Un verdict, et tu joues.",
  },

  footer: {
    built: "Construit par Karim Sehil",
    source: "Le code sur GitHub",
    tag: "Un projet portfolio · Ce soir, tu joues à ça.",
  },
};

export const landing: Record<Locale, typeof en> = { en, fr };
