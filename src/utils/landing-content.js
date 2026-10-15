// Texts of the public pages (chantier 8), in a plain module so the
// translation guard (tests/i18n.test.mjs) checks them too.
export const PUBLIC_LINKS = [
  { to: '/decouvrir', label: 'Découvrir VAUDAX' },
  { to: '/installer', label: 'Installer sur ton téléphone' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions', label: 'Conditions d’utilisation' },
  { to: '/accessibilite', label: 'Accessibilité' },
];
export const PILLARS = [
  { icon: 'sun', title: 'Aujourd’hui', text: 'Chaque matin, ce qu’il reste à faire : habitudes à cocher, médicaments, rendez-vous, échéances. Un oubli d’hier se rattrape en un geste.' },
  { icon: 'health', title: 'Santé', text: 'Sommeil, repas, sport ou exercices doux, tension, médicaments avec rappels, rendez-vous, fiche d’urgence.' },
  { icon: 'money', title: 'Argent', text: 'Noter une dépense en quelques secondes, suivre son budget, ses factures et son épargne, dans sa propre monnaie.' },
  { icon: 'learn', title: 'Apprendre', text: 'Cours, emploi du temps, notes et révisions pour les études ; lectures, langue, instrument ou permis pour tout le monde.' },
];
export const FOR_WHOM = [
  'Un étudiant qui jongle entre cours, examens et petit budget.',
  'Une personne active qui veut garder la forme et ses comptes en ordre.',
  'Un parent ou un aidant qui pense aux rendez-vous et aux traitements.',
  'Une personne âgée qui veut un outil simple, en grands caractères.',
];
export const PROMISES = [
  { icon: 'type', text: 'Lisible par tous : texte agrandi, contraste fort, mode Simple sans jargon.' },
  { icon: 'undo', text: 'Rien n’est définitif : tout se corrige, même un jour passé, et une suppression s’annule.' },
  { icon: 'phone', text: 'Sur téléphone et ordinateur, même hors connexion ; tout se retrouve sur chaque appareil avec un compte.' },
  { icon: 'shield', text: 'Tes données restent à toi : pas de publicité, pas de revente, export et suppression à tout moment.' },
];
// Installation guide: one list of steps per system.
export const INSTALL_STEPS = {
  iphone: [
    'Ouvre VAUDAX dans Safari (pas dans une autre application).',
    'Touche le bouton Partager : le carré avec une flèche vers le haut, en bas de l’écran.',
    'Fais défiler et touche « Sur l’écran d’accueil ».',
    'Touche « Ajouter » : l’icône VAUDAX apparaît avec tes autres applications.',
    'Ouvre VAUDAX depuis cette icône, puis active les notifications dans Paramètres pour recevoir les rappels.',
  ],
  android: [
    'Ouvre VAUDAX dans Chrome.',
    'Touche le menu ⋮ en haut à droite.',
    'Touche « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
    'Confirme : l’icône VAUDAX apparaît avec tes autres applications.',
    'Appuie longtemps sur l’icône pour ouvrir directement la fiche d’urgence ou les médicaments du jour.',
  ],
  computer: [
    'Ouvre VAUDAX dans Chrome ou Edge.',
    'Clique sur l’icône d’installation à droite de la barre d’adresse (un écran avec une flèche).',
    'Clique sur « Installer » : VAUDAX s’ouvre dans sa propre fenêtre.',
  ],
};
