// The « ? » of every screen (chantier 4, G11): what the page is for and how to
// use it, in three short lines. Keyed by navigation module (utils/navigation.js)
// or by a few extra pages.

export const HELP = {
  today: {
    title: 'Aujourd’hui',
    lines: [
      'Ce qu’il te reste à faire aujourd’hui : habitudes, check-in, cours, échéances.',
      'Touche un rond pour cocher une habitude. Le bandeau « Hier » rattrape un oubli.',
      '« Organiser » change l’ordre des cartes ou en masque.',
    ],
  },
  week: {
    title: 'Ma semaine',
    lines: [
      'Toute ta semaine, jour par jour : cours, habitudes, évaluations, échéances, sport.',
      'Touche une habitude pour la cocher, même pour un jour passé.',
      'Les flèches changent de semaine.',
    ],
  },
  goals: {
    title: 'Objectifs',
    lines: [
      'Tous tes objectifs au même endroit : santé, argent, études, habitudes.',
      'Chaque carte montre où tu en es et ce qu’il reste.',
      '« Créer un objectif » t’emmène dans la bonne section.',
    ],
  },
  habits: {
    title: 'Habitudes',
    lines: [
      'Tes routines : à cocher, à mesurer (verres d’eau, pages…) ou à arrêter.',
      'Touche « Fait » pour cocher. Les flèches en haut changent de jour pour rattraper un oubli.',
      'Le crayon modifie une habitude ; l’archiver garde son historique.',
    ],
  },
  focus: {
    title: 'Concentration',
    lines: [
      'Un chrono pour travailler sans interruption, et l’historique de tes sessions.',
      'Choisis une durée, puis « Démarrer ». Une session oubliée s’ajoute à la main.',
      'Le crayon corrige une session (jour, durée, note).',
    ],
  },
  timeline: {
    title: 'Chronologie',
    lines: [
      'Tout ce que tu as noté, sur une seule ligne du temps.',
      'Plus bas : les liens trouvés entre tes habitudes, ton sommeil, ton travail et tes dépenses.',
      'Touche un lien pour voir les jours qui le montrent.',
    ],
  },
  challenges: {
    title: 'Défis',
    lines: [
      'Des défis entre amis : qui tient le mieux son habitude sur une période.',
      'Crée un défi et partage son code, ou rejoins-en un avec un code.',
      'Le classement se met à jour tout seul avec tes saisies.',
    ],
  },
  learning: {
    title: 'Études',
    lines: [
      'Tes cours, ton emploi du temps, tes évaluations et tes révisions.',
      'Les onglets en haut changent de partie. Une photo de l’emploi du temps peut le remplir pour toi.',
      'Les fiches de révision reviennent au bon moment pour être retenues.',
    ],
  },
  readings: {
    title: 'Lectures',
    lines: [
      'Les livres que tu lis et ta progression page par page.',
      '« + Page » ou « Aller à la page » note où tu en es.',
      'La Bibliothèque propose plus de 1 000 livres à ajouter.',
    ],
  },
  skills: {
    title: 'Compétences',
    lines: [
      'Ce que tu apprends en pratiquant : chaque cours, lecture ou séance fait monter tes compétences.',
      'Les niveaux 4 et 5 demandent une preuve (examen, projet, résultat).',
      'Touche une compétence pour voir d’où vient ta progression.',
    ],
  },
  creative: {
    title: 'Création',
    lines: [
      'Tes œuvres (musique, écriture, dessin…) et leur avancement.',
      'Ajoute une œuvre, puis ses expositions ou publications.',
      'Le temps passé se note avec le Minuteur.',
    ],
  },
  health: {
    title: 'Santé',
    lines: [
      'Ton sommeil, tes repas, ton sport et ta forme du jour.',
      'Le check-in du jour se remplit en 30 secondes, aussi pour hier.',
      'Les espaces en haut : Entraînement, Soins (médicaments, mesures, rendez-vous, fiche d’urgence), Nutrition, Corps, Progrès.',
    ],
  },
  finance: {
    title: 'Finances',
    lines: [
      'Tes dépenses, revenus, budget, échéances et épargne.',
      'Le bouton + ou « Noter une dépense » enregistre une opération en quelques secondes.',
      'Le mode Simple cache la comptabilité ; le mode Expert la montre.',
    ],
  },
  settings: {
    title: 'Paramètres',
    lines: [
      'Taille du texte, thème, niveau Simple ou Expert : tout en haut.',
      'Ton profil, la synchronisation entre appareils et tes sauvegardes.',
      'La corbeille garde 30 jours ce que tu as supprimé.',
    ],
  },
  leaderboard: {
    title: 'Classement',
    lines: [
      'Ton XP comparée à celle des autres utilisateurs de VAUDAX.',
      'L’XP vient de tout ce que tu fais dans le site.',
      'Les paliers montrent les grades à atteindre.',
    ],
  },
};

export const helpFor = (moduleKey, pathname = '') => HELP[moduleKey]
  || (pathname.startsWith('/settings') ? HELP.settings : pathname.startsWith('/leaderboard') ? HELP.leaderboard : HELP.today);

// The guided tour shown once to new accounts (and on demand from the « ? »).
export const TOUR = [
  { title: 'Bienvenue sur VAUDAX', text: 'Un seul endroit pour ta journée, ta santé, tes études et ton argent. Rien n’est obligatoire : prends ce qui t’aide.' },
  { title: 'Aujourd’hui', text: 'Chaque matin, cet écran te dit ce qu’il reste à faire. Touche une habitude pour la cocher.' },
  { title: 'Le bouton +', text: 'En bas à droite. Écris simplement « 120 courses » ou « dormi 7 h » : VAUDAX range au bon endroit.' },
  { title: 'Rien n’est définitif', text: 'Tout se corrige, même pour un jour passé. Une suppression s’annule, et la corbeille garde 30 jours. Le « ? » en haut explique chaque écran.' },
];
