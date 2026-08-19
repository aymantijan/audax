// ─────────────────────────────────────────────────────────────────────────────
// CURATED PROGRAM — "Programme d'Entraînement Extrême"
// Imported verbatim (structured, not generated) from a user-supplied PDF.
// Curated programs are read-only by design (see curated-programs/index.js
// header) — a user who wants to change an exercise saves a *variant*
// (healthStore.saveProgramVariant) instead of editing this file.
// ─────────────────────────────────────────────────────────────────────────────
export const PROGRAMME_EXTREME = {
  id: 'programme-extreme',
  name: "Programme d'Entraînement Extrême",
  subtitle: 'Force Maximale · Volume Musculaire Complet · Agilité & Mobilité',
  tags: ['force', 'hypertrophie', 'avancé', 'cardio', 'agilité', '5j/semaine'],
  designedFor: 'Homme, 25 ans — Casablanca, Maroc — Master 1 ISCAE',
  objective: 'Dépasser les standards naturels · maintenir 15% bodyfat · protéger le système nerveux',
  // Machine-readable timing rules — drives the generic schedule generator
  // (program-schedule-generator.js), which reasons about these fields for
  // ANY curated program, not just this one.
  schedulingRules: {
    fastedCardioMorning: true,
    minGapHoursCardioToTraining: 5,
    qualityCardioMinGapBeforeLegsHours: 48,
  },
  sources: [
    'Schoenfeld et al. 2016 (volume/fréquence hypertrophie)',
    'Helms et al. 2014 (nutrition physique)',
    'Wilson et al. 2012 (interférence concurrent training)',
    'Rhea et al. 2003 (périodisation)',
    'Cotman & Berchtold 2002 (exercice et BDNF/neurogenèse)',
    'Lupien et al. 2009 (cortisol chronique et cognition)',
    "ACSM Position Stand (prescription d'exercice)",
  ],

  scientificFramework: [
    {
      title: '1. La réalité génétique',
      body: "« Plus fort et plus volumineux que n'importe quel homme » est une formulation extrême — au sens littéral, impossible à garantir (génétique, âge d'entraînement, réponse hormonale individuelle varient énormément). Ce que ce programme PEUT garantir : il pousse vers le plafond génétique naturel maximal, avec la méthodologie la plus rigoureuse qui existe. La plupart des gens n'utilisent même pas 60% de leur potentiel parce qu'ils s'entraînent sans structure.",
    },
    {
      title: "2. L'effet d'interférence (le piège principal)",
      body: "Faire du cardio ET de la force au maximum en même temps n'est pas gratuit physiologiquement. Voie mTOR (hypertrophie/force) ↔ Voie AMPK (endurance) : ces deux voies de signalisation cellulaire sont partiellement antagonistes (Baar, 2014). Wilson et al. 2012 (méta-analyse, 21 études) : l'interférence touche surtout la puissance et la force des jambes, et elle est minimisée si les séances sont séparées de 6h ou plus, avec un volume de cardio modéré en Zone 2 plutôt qu'intense. La structure de ce programme (cardio le matin à jeun, musculation l'après-midi) respecte déjà cette règle.",
    },
    {
      title: '3. Ce programme est agressif',
      body: "Il est construit en blocs périodisés (pas « tout à fond tout le temps » — c'est justement l'erreur qui mène à la stagnation et à la blessure). Chaque bloc a un focus différent. C'est ce qui permet de progresser sur les 3 fronts sans se cramer.",
    },
  ],

  context: {
    phaseA: {
      label: 'Phase A — Fenêtre flexible',
      dateRange: '17 août → 30 septembre 2026',
      points: [
        'Stage d\'approfondissement en télétravail, sans obligation de pointage → liberté totale sur les horaires de la journée.',
        'Réveil 6h30, salle de sport ouverte dès 7h30.',
        "C'est la fenêtre à exploiter au maximum : Bloc 1 (Accumulation) est étendu à 6 semaines pour construire le maximum de base avant la rentrée.",
      ],
    },
    phaseB: {
      label: 'Phase B — Fenêtre contrainte',
      dateRange: 'à partir du 1er octobre 2026',
      points: [
        'Rentrée en Master 1 à l\'ISCAE : cours de 8h30 à 16h15 (jours courts) ou jusqu\'à 20h (jours longs), + 30 min de trajet chaque sens.',
        'Beaucoup moins de marge dans la journée → la logistique des séances doit changer, pas nécessairement le contenu du programme.',
      ],
    },
    note: "Natation — disponible à partir de janvier/février 2027. Elle n'entre pas dans ce cycle ; elle sera introduite au cycle suivant pour varier les articulations sollicitées et offrir une option cardio à zéro impact, particulièrement utile en période d'examens.",
  },

  macrocycle: [
    { block: '1 — Accumulation', dates: '17 août – 27 sept (Phase A, 6 sem.)', focus: 'Hypertrophie (volume max)', volume: 'Très élevé (14-20 séries/muscle/sem)', intensity: '65-75% 1RM · 8-15 reps', cardio: 'Zone 2 pure', agility: 'Mobilité + agilité légère' },
    { block: '2 — Force-Hypertrophie', dates: '28 sept – 25 oct (Transition A→B, 4 sem.)', focus: 'Force + volume maintenu', volume: 'Élevé (12-16 séries/muscle/sem)', intensity: '75-85% 1RM · 5-8 reps', cardio: 'Zone 2 + 1x tempo/sem', agility: 'Agilité modérée' },
    { block: '3 — Force Max & Puissance', dates: '26 oct – 22 nov (Phase B, 4 sem.)', focus: 'Force pure + explosivité', volume: 'Modéré (8-12 séries/muscle/sem)', intensity: '85-95% 1RM · 1-5 reps', cardio: 'Zone 2 réduite (maintien)', agility: 'Pliométrie + puissance PIC' },
    { block: '4 — Deload', dates: '23 – 29 nov (Phase B)', focus: 'Récupération complète', volume: '50% volume', intensity: '50-60% 1RM', cardio: 'Zone 2 légère', agility: 'Mobilité seule' },
    { block: '—', dates: '30 nov – 13 déc', focus: 'Retest + nouveau cycle', volume: 'Tests de force (1RM), ajuster le prochain cycle selon progrès', intensity: '—', cardio: '—', agility: '—' },
  ],
  macrocycleNote: "Pourquoi ça marche mieux que « tout à fond tout le temps » : le corps s'adapte au stress spécifique. Un bloc dédié au volume construit du muscle. Un bloc dédié à l'intensité construit de la force sur ce muscle. Faire les deux à fond en permanence = ni l'un ni l'autre ne progresse (Rhea et al., 2003 — avantage net à la périodisation).",

  // day: French weekday key used to match "today" in the app (lundi..dimanche)
  weeklyStructure: {
    // Used by the store to auto-pick phaseA vs phaseB display based on
    // today's date — generic mechanism, optional (a single-phase program
    // like programme-debutant.js just omits this and uses `main`).
    phaseSwitchDate: '2026-10-01',
    phaseA: [
      { day: 'lundi', label: 'Lundi', morning: '6h45 Course Zone 2 — 30-35 min à jeun + Mobilité 10 min', midday: 'Petit-déj 7h30 → Stage télétravail', session: 'push1', sessionTime: '13h-14h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'push1' }] },
      { day: 'mardi', label: 'Mardi', morning: "6h45 Course Zone 2 + Échelle d'agilité 15 min", midday: 'Petit-déj → Stage télétravail', session: 'pull1', sessionTime: '13h-14h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'pull1' }] },
      { day: 'mercredi', label: 'Mercredi', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: 'Étirements légers si besoin (optionnel)', blocks: [] },
      { day: 'jeudi', label: 'Jeudi', morning: '6h45 Course Zone 2 + Mobilité 10 min', midday: 'Petit-déj → Stage télétravail', session: 'legs', sessionTime: '13h-14h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'legs' }] },
      { day: 'vendredi', label: 'Vendredi', morning: "6h45 Course Zone 2 + Échelle d'agilité 15 min", midday: 'Petit-déj → Stage télétravail', session: 'push2', sessionTime: '13h-14h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'push2' }] },
      { day: 'samedi', label: 'Samedi', morning: '7h00 Vélo Zone 2 — 30-35 min + Mobilité', midday: 'Libre', session: 'pullLegs2', sessionTime: '12h-13h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'pullLegs2' }] },
      { day: 'dimanche', label: 'Dimanche', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: '—', blocks: [] },
    ],
    phaseB: [
      { day: 'lundi', label: 'Lundi', morning: '6h40 Course Zone 2 — 25-30 min à jeun (léger, rapide)', midday: 'Cours (+ 30 min trajet chaque sens)', session: 'push1', sessionTime: '18h00-19h15 (jour court)', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'push1' }] },
      { day: 'mardi', label: 'Mardi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'pull1', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'pull1' }] },
      { day: 'mercredi', label: 'Mercredi', morning: 'REPOS COMPLET', midday: 'Cours ou libre', session: null, sessionTime: 'REPOS COMPLET', blocks: [] },
      { day: 'jeudi', label: 'Jeudi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'legs', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'legs' }] },
      { day: 'vendredi', label: 'Vendredi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'push2', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'push2' }] },
      { day: 'samedi', label: 'Samedi', morning: '7h00 Vélo Zone 2 — 30 min', midday: 'Libre', session: 'pullLegs2', sessionTime: 'Horaire libre', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'pullLegs2' }] },
      { day: 'dimanche', label: 'Dimanche', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: '—', blocks: [] },
    ],
    notes: [
      "Pourquoi ne pas coller la musculation juste après le cardio à 7h30 : le corps a besoin d'environ 5h pour reconstituer le glycogène après une course à jeun — recharger avant de soulever lourd donne une meilleure performance et une meilleure prise de muscle. La salle ouvre à 7h30 : possible d'y aller directement après le réveil certains jours si l'emploi du temps l'exige, en gardant alors le cardio très léger ce jour-là (marche 15 min).",
      "Pourquoi vélo le samedi et pas course : 4 sorties de course dans la semaine suffisent. Le vélo du samedi réduit l'impact articulaire cumulé sur les genoux/chevilles tout en gardant le volume cardio.",
      "Sur un jour court (sortie 16h15) : le trajet retour (30 min) laisse le temps de manger puis d'aller à la salle vers 18h.",
      "Règle pour les jours longs (sortie à 20h) : garder uniquement le cardio Zone 2 le matin (pas de musculation avant les cours), puis soit une séance courte en fin de soirée si la salle reste ouverte tard, soit un échange avec un jour normalement plus léger de la même semaine (jamais avec mercredi ou dimanche).",
    ],
  },

  // Bloc 1 detailed sessions — exercises are free-text (loggable via
  // WorkoutLogging's custom-exercise field; French names kept verbatim).
  sessions: {
    push1: {
      label: 'PUSH 1 (Pecs / Épaules / Triceps)',
      day: 'lundi',
      exercises: [
        { name: 'Développé couché barre', setsReps: '4 × 6-8', rest: '2-3 min', note: 'Base force' },
        { name: 'Développé incliné haltères', setsReps: '4 × 8-10', rest: '2 min', note: '' },
        { name: 'Dips lestés', setsReps: '3 × 8-12', rest: '2 min', note: '', bodyweightExercise: true },
        { name: 'Écarté câble (poulie basse→haute)', setsReps: '3 × 12-15', rest: '60-90s', note: 'Étirement pec' },
        { name: 'Développé militaire barre', setsReps: '4 × 6-8', rest: '2-3 min', note: '' },
        { name: 'Élévations latérales', setsReps: '4 × 12-15', rest: '60s', note: 'Deltoïde moyen' },
        { name: 'Extension triceps poulie haute', setsReps: '3 × 12-15', rest: '60s', note: '' },
        { name: 'Dips triceps (buste droit)', setsReps: '3 × 10-12', rest: '60-90s', note: '', bodyweightExercise: true },
      ],
    },
    pull1: {
      label: 'PULL 1 (Dos / Biceps / Avant-bras / Nuque)',
      day: 'mardi',
      exercises: [
        { name: 'Tractions lestées (ou assistées)', setsReps: '4 × 6-10', rest: '2-3 min', note: 'Largeur dorsale', bodyweightExercise: true },
        { name: 'Rowing barre buste penché', setsReps: '4 × 8-10', rest: '2 min', note: 'Épaisseur dos' },
        { name: 'Tirage horizontal câble', setsReps: '3 × 10-12', rest: '90s', note: '' },
        { name: 'Rowing unilatéral haltère', setsReps: '3 × 10-12/côté', rest: '90s', note: '' },
        { name: 'Face pull', setsReps: '3 × 15-20', rest: '60s', note: 'Santé épaule + deltoïde postérieur' },
        { name: 'Curl barre EZ', setsReps: '4 × 8-10', rest: '90s', note: '' },
        { name: 'Curl marteau', setsReps: '3 × 10-12', rest: '60s', note: 'Avant-bras + biceps' },
        { name: 'Curl poignet (flexion/extension)', setsReps: '3 × 15-20 chaque', rest: '45s', note: 'Avant-bras' },
        { name: 'Nuque (harnais)', setsReps: '3 × 15-20 × 4 directions', rest: '45s', note: 'Flexion/extension/latéral G-D' },
      ],
    },
    legs: {
      label: 'LEGS (Quadriceps / Ischios / Fessiers / Mollets)',
      day: 'jeudi',
      exercises: [
        { name: 'Squat barre', setsReps: '5 × 6-8', rest: '3 min', note: 'Roi des exercices jambes' },
        { name: 'Presse à cuisses', setsReps: '4 × 10-12', rest: '2 min', note: '' },
        { name: 'Soulevé de terre roumain', setsReps: '4 × 8-10', rest: '2-3 min', note: 'Ischios + fessiers' },
        { name: 'Fentes marchées lestées', setsReps: '3 × 12/jambe', rest: '90s', note: 'Unilatéral' },
        { name: 'Leg curl allongé', setsReps: '3 × 12-15', rest: '90s', note: 'Ischios isolés' },
        { name: 'Hip thrust barre', setsReps: '4 × 10-12', rest: '2 min', note: 'Fessiers ciblés' },
        { name: 'Mollets debout', setsReps: '5 × 15-20', rest: '60s', note: 'Fréquence élevée nécessaire' },
        { name: 'Mollets assis', setsReps: '3 × 15-20', rest: '60s', note: 'Soléaire' },
      ],
    },
    push2: {
      label: 'PUSH 2 (Épaules focus / Pecs accessoire / Triceps / Nuque)',
      day: 'vendredi',
      exercises: [
        { name: 'Développé militaire haltères', setsReps: '4 × 8-10', rest: '2 min', note: '' },
        { name: 'Élévations latérales (variante lente)', setsReps: '4 × 15-20', rest: '60s', note: 'Volume deltoïde' },
        { name: 'Oiseau (deltoïde postérieur)', setsReps: '4 × 15-20', rest: '60s', note: '' },
        { name: 'Développé couché prise serrée', setsReps: '3 × 8-10', rest: '2 min', note: 'Pecs + triceps' },
        { name: 'Écarté incliné haltères', setsReps: '3 × 12-15', rest: '90s', note: '' },
        { name: 'Barre au front', setsReps: '3 × 10-12', rest: '90s', note: 'Triceps longue portion' },
        { name: 'Extension triceps unilatérale', setsReps: '3 × 12-15', rest: '60s', note: '' },
        { name: 'Nuque (harnais)', setsReps: '3 × 15-20 × 4 directions', rest: '45s', note: '2e session/semaine' },
      ],
    },
    pullLegs2: {
      label: 'PULL/LEGS 2 + ABS (Dos accessoire / Biceps / Legs accessoire / Core)',
      day: 'samedi',
      exercises: [
        { name: 'Tirage vertical (lat pulldown)', setsReps: '4 × 10-12', rest: '90s', note: '' },
        { name: 'Rowing T-bar', setsReps: '3 × 10-12', rest: '90s', note: '' },
        { name: 'Shrugs barre', setsReps: '3 × 12-15', rest: '90s', note: 'Trapèzes' },
        { name: 'Curl incliné haltères', setsReps: '3 × 10-12', rest: '60s', note: 'Étirement biceps' },
        { name: 'Curl concentration', setsReps: '2 × 12-15', rest: '45s', note: '' },
        { name: 'Extension jambes', setsReps: '3 × 12-15', rest: '90s', note: 'Quadriceps isolé' },
        { name: 'Leg curl assis', setsReps: '3 × 12-15', rest: '90s', note: '' },
        { name: 'Relevé de jambes suspendu', setsReps: '4 × 12-15', rest: '60s', note: 'Abdos inférieurs' },
        { name: 'Crunch câble', setsReps: '3 × 15-20', rest: '60s', note: '' },
        { name: 'Planche (gainage)', setsReps: '3 × 45-60s', rest: '60s', note: '' },
        { name: 'Ab wheel', setsReps: '3 × 10-15', rest: '60s', note: '' },
      ],
    },
  },

  weeklyVolume: [
    { group: 'Pecs', sets: '14-16', zone: '10-20' },
    { group: 'Épaules (3 faisceaux)', sets: '15-19', zone: '12-22' },
    { group: 'Dos', sets: '17-20', zone: '14-22' },
    { group: 'Biceps', sets: '9-11', zone: '8-16' },
    { group: 'Triceps', sets: '8-10', zone: '8-16' },
    { group: 'Avant-bras', sets: '4-6 direct + grip constant', zone: '—' },
    { group: 'Quadriceps', sets: '13-15', zone: '10-18' },
    { group: 'Ischios', sets: '10-13', zone: '8-16' },
    { group: 'Fessiers', sets: '10-12', zone: '8-16' },
    { group: 'Mollets', sets: '8-10 (fréquence 2x)', zone: '8-16, freq 2x recommandée' },
    { group: 'Abdos', sets: '10-13 direct + gainage', zone: '—' },
    { group: 'Nuque', sets: '6 (2x/semaine)', zone: '4-8' },
  ],
  weeklyVolumeNote: "Fréquence de 2x/semaine par muscle = le sweet spot confirmé par la littérature (Schoenfeld et al., 2016).",

  cardioProgram: [
    { block: 'Bloc 1', course: '4x/sem, 35 min Zone 2 (117-140 bpm)', velo: '1x/sem (Samedi), 35 min Zone 2', logique: 'Base aérobie, zéro interférence' },
    { block: 'Bloc 2', course: '3x/sem Zone 2 (35 min) + 1x/sem tempo (Zone 3-4, 20 min, mardi de préférence)', velo: '1x/sem Zone 2', logique: 'Introduction stimulus qualité' },
    { block: 'Bloc 3', course: '2-3x/sem Zone 2 courte (20-25 min, maintenance)', velo: '1x/sem sprints (30s effort max / 4 min récup × 6)', logique: 'Puissance > volume, priorité récupération' },
    { block: 'Bloc 4 (deload)', course: '2x/sem, 20 min Zone 1-2 facile', velo: '—', logique: 'Récupération pure' },
  ],
  cardioRule: 'Règle absolue : jamais de séance cardio « qualité » (tempo/sprint) la veille ou le matin d\'un jour LEGS. Toujours 48h d\'écart minimum entre cardio intense et squats/deadlifts lourds.',

  agilityMobility: [
    { title: 'Le matin (avant course, 10 min) — Mobilité articulaire (CARs)', items: ['Rotations contrôlées : épaules, hanches, chevilles, colonne (2 × 5 rotations/articulation)', 'Balancements de jambes (avant-arrière, latéral) : 2 × 10/jambe', 'Fentes avec rotation du buste : 2 × 8/côté'] },
    { title: "Mardi & Vendredi (15 min) — Échelle d'agilité + réactivité", items: ['Icky shuffle, in-in-out-out, pas chassés latéraux : 4 exercices × 3 passages', 'Sprints courts avec changement de direction (5-10m) : 6 répétitions', 'Progression Bloc 3 : ajout de sauts pliométriques (box jumps, broad jumps, bonds latéraux) 3 × 5'] },
    { title: 'Le soir (10 min, tous les jours d\'entraînement) — Étirements statiques', items: ['Chaîne postérieure (ischios, mollets, dos) : 3 × 30s', 'Chaîne antérieure (quadriceps, fléchisseurs de hanche, pecs) : 3 × 30s', 'Respiration profonde pendant les étirements = bonus récupération nerveuse'] },
    { title: 'Bloc 3 uniquement — Puissance explosive (2x/semaine, jours non-jambes lourdes)', items: ['Squat sauté : 4 × 5', 'Développé lancer (medecine ball throw) : 4 × 5', 'Fentes sautées : 3 × 6/jambe', "(Optionnel, technique requise) Variantes d'haltérophilie : hang clean, push press — recommandé avec supervision technique au début"] },
  ],

  nutrition: {
    objective: 'Maintenir/atteindre 15% de masse grasse',
    intro: "15% de bodyfat est un objectif de recomposition raisonnable et durable. La stratégie dépend du point de départ, mesuré via l'estimation Navy déjà disponible dans le Health Dashboard.",
    strategyByBodyfat: [
      { condition: 'Bodyfat actuel > 17-18%', strategy: 'Léger déficit calorique (-200 à -300 kcal/jour) pendant les Blocs 1-2, en gardant les protéines hautes pour préserver le muscle malgré le déficit.' },
      { condition: 'Bodyfat actuel proche de 15%', strategy: 'Recomposition à calories de maintenance (perte de gras et gain de muscle en parallèle, plus lent mais le plus élégant avec ce volume d\'entraînement).' },
      { condition: 'Bodyfat actuel < 13-14%', strategy: 'Léger surplus (+200-300 kcal) possible pendant les Blocs 1-2 pour maximiser l\'hypertrophie, avec un ajustement en Bloc 3 pour ne pas dépasser 15-16%.' },
    ],
    macros: {
      proteinPerKg: '2.0-2.2 g/kg de poids de corps',
      proteinNote: 'Haut de la fourchette car volume extrême, et protège la masse musculaire même en déficit — Helms et al., 2014.',
      carbsPerKg: '6-8 g/kg',
      carbsNote: 'Carburant pour double séances quotidiennes.',
      fatPerKg: '0.8-1 g/kg',
      fatNote: 'Fonction hormonale, ne pas descendre en dessous.',
      calorieRule: 'Ajuster autour de la maintenance selon le scénario (Blocs 1-2) · Maintenance ± 0 en Bloc 3 (focus force/technique) · réévaluer à chaque bloc selon la progression du bodyfat mesurée.',
    },
  },

  cognitivePerformance: {
    intro: "L'idée d'un cerveau qui tourne à plein régime (mémoire nette, décisions rapides) est atteignable par des leviers validés scientifiquement, intégrés dans ce programme :",
    points: [
      'Le cardio Zone 2 stimule le BDNF et la neurogenèse hippocampique (mémoire, apprentissage) — Cotman & Berchtold, 2002.',
      'Le sommeil profond consolide la mémoire déclarative (cours, lectures) — non négociable, particulièrement en période d\'examens.',
      "La musculation elle-même élève le BDNF et l'IGF-1, bénéfiques pour la cognition.",
      'Le surentraînement fait l\'inverse : cortisol chronique élevé = dégradation mesurable de la mémoire et de la concentration — Lupien et al., 2009. La périodisation en blocs et les semaines de deload de ce programme empêchent précisément cela.',
    ],
    conclusion: "Conséquence concrète : le sommeil et les semaines de deload ne sont pas des options « si le temps le permet » — ce sont les garde-fous qui protègent directement la capacité de travail intellectuel, pas seulement la récupération musculaire.",
  },

  monitoring: {
    autoRegulation: [
      { range: 'Score ≥ 80', action: 'Séance complète comme prévu' },
      { range: 'Score 60-79', action: 'Réduire le volume de 20% (une série en moins par exercice)' },
      { range: 'Score < 60', action: 'Cardio Zone 1 léger seulement, pas de musculation lourde ce jour' },
    ],
    alertSignals: [
      'Énergie < 5/10 pendant 3+ jours consécutifs',
      'Stress > 7/10 pendant 5+ jours',
      'Sommeil < 7h pendant 5+ jours',
      'Force stagnante ou en baisse sur 2 séances consécutives',
      'Douleur articulaire persistante (pas juste des courbatures musculaires)',
    ],
    alertRule: '2+ signaux déclenchés simultanément = pause obligatoire de 3-5 jours.',
  },

  limits: [
    "Le temps est le facteur limitant, pas la volonté. Hypertrophie visible significative : 12-16 semaines minimum. Force notable (+15-20% sur les compounds) : 16-20 semaines. Ce n'est pas un programme « 6 semaines miracle » — c'est un système à répéter en cycles sur 1-2 ans.",
    "Un lifter naturel a un plafond. Avec une génétique moyenne-bonne, un entraînement optimal et une nutrition parfaite : environ 0.5-1% de gain de masse musculaire par mois la première année, beaucoup moins ensuite.",
    "Ce volume nécessite un sommeil irréprochable. 8h ou plus n'est plus optionnel à ce niveau de charge — c'est la variable qui déterminera si la progression se fait ou si la stagnation/blessure survient.",
    "Semaine 1-2 : une fatigue d'adaptation est normale. Si à la semaine 3 la fatigue reste en zone rouge, réduire un cran (retirer une séance cardio de qualité, garder seulement la Zone 2).",
  ],
};
