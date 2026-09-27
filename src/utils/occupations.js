// Suggestions for the free "Métier ou domaine" profile field — every kind of
// user, not one profile (principle "pour tous les profils", CLAUDE.md). Free
// text: anything typed is kept as is.
export const OCCUPATION_SUGGESTIONS = [
  'Étudiant·e', 'Lycéen·ne', 'Doctorant·e', 'En recherche d’emploi', 'En reconversion',
  'Développeur·se', 'Data analyst', 'Ingénieur·e', 'Technicien·ne', 'Designer',
  'Infirmier·e', 'Médecin', 'Pharmacien·ne', 'Kinésithérapeute', 'Aide-soignant·e',
  'Enseignant·e', 'Formateur·rice', 'Chercheur·se',
  'Commercial·e', 'Marketing', 'Chef·fe de projet', 'Manager', 'Ressources humaines', 'Assistant·e de direction',
  'Comptable', 'Auditeur·rice', 'Analyste financier·ère', 'Banquier·ère', 'Trader', 'Investisseur·se',
  'Entrepreneur·e', 'Freelance', 'Consultant·e', 'Commerçant·e', 'Artisan·e', 'Agriculteur·rice',
  'Avocat·e', 'Juriste', 'Fonctionnaire', 'Militaire', 'Policier·ère',
  'Artiste', 'Musicien·ne', 'Écrivain·e', 'Créateur·rice de contenu', 'Photographe',
  'Sportif·ve', 'Coach sportif', 'Parent au foyer', 'Retraité·e',
];

// Profiles created before this field existed only have the old finance-only
// career goal; it is not shown as a profession anymore.
export const occupationOf = (user) => (user?.occupation || '').trim();
