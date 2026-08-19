// ─────────────────────────────────────────────────────────────────────────────
// CURATED PROGRAM — "Programme Débutant Full Body" — a second, simpler
// example built in the same shape as programme-extreme.js, to demonstrate
// that the curated-program system generalizes to any program the user adds
// later, not just the "Extrême" one. Same read-only + variant rules apply.
// ─────────────────────────────────────────────────────────────────────────────
export const PROGRAMME_DEBUTANT = {
  id: 'programme-debutant',
  name: 'Programme Débutant Full Body',
  subtitle: 'Base solide · Technique · Constance sur 3 séances/semaine',
  tags: ['débutant', 'full body', '3j/semaine', 'technique'],
  designedFor: "Toute personne qui commence la musculation en salle, quel que soit l'âge ou le niveau initial",
  objective: 'Construire une base de force et de technique sur les mouvements fondamentaux, sans surcharge de complexité',
  sources: [
    'Schoenfeld et al. 2016 (fréquence et volume optimaux)',
    'ACSM Position Stand (progression pour débutants)',
    'Rhea et al. 2003 (dose-réponse en musculation)',
  ],

  scientificFramework: [
    {
      title: 'Pourquoi full body pour débuter',
      body: "Chez un débutant, la fréquence de stimulation compte plus que le volume par séance : entraîner chaque muscle 3x/semaine avec un volume modéré par séance produit de meilleurs gains qu'un split qui ne le touche qu'1x/semaine, le temps que la technique et la capacité de récupération se développent (Schoenfeld et al., 2016).",
    },
    {
      title: 'Progression simple et robuste',
      body: "Double progression : dès que le haut de la fourchette de répétitions est atteint sur toutes les séries d'un exercice, la charge augmente légèrement à la séance suivante. Pas besoin d'autorégulation complexe à ce stade — la constance et la technique priment.",
    },
  ],

  context: {
    note: 'Programme à suivre tel quel pendant 8-12 semaines avant d\'envisager un split plus avancé (type Programme Extrême) — le temps nécessaire pour construire la base technique et articulaire.',
  },

  macrocycle: [
    { block: 'Semaines 1-4', dates: '—', focus: 'Apprentissage technique', volume: 'Modéré (8-10 séries/muscle/sem)', intensity: '60-70% 1RM · 10-12 reps', cardio: 'Zone 2, 2x/sem', agility: 'Mobilité de base' },
    { block: 'Semaines 5-8', dates: '—', focus: 'Consolidation + charge progressive', volume: 'Modéré-élevé (10-12 séries/muscle/sem)', intensity: '65-75% 1RM · 8-12 reps', cardio: 'Zone 2, 2-3x/sem', agility: 'Mobilité + gainage' },
    { block: 'Semaines 9-12', dates: '—', focus: 'Transition vers un split avancé', volume: 'Élevé (12-14 séries/muscle/sem)', intensity: '70-80% 1RM · 6-10 reps', cardio: 'Zone 2, 2-3x/sem', agility: 'Mobilité + gainage' },
  ],
  macrocycleNote: "Après 12 semaines, la base technique et la capacité de récupération permettent généralement de passer à un split par groupe musculaire (upper/lower ou push/pull/legs) avec plus de volume total.",

  weeklyStructure: {
    main: [
      { day: 'lundi', label: 'Lundi', morning: '', midday: '', session: 'fullBodyA', sessionTime: 'Séance libre dans la journée', blocks: [{ type: 'training', sessionKey: 'fullBodyA' }] },
      { day: 'mardi', label: 'Mardi', morning: '20-30 min cardio Zone 2 (optionnel)', midday: '', session: null, sessionTime: 'Repos musculation', blocks: [{ type: 'cardio', durationMin: 25, optional: true }] },
      { day: 'mercredi', label: 'Mercredi', morning: '', midday: '', session: 'fullBodyB', sessionTime: 'Séance libre dans la journée', blocks: [{ type: 'training', sessionKey: 'fullBodyB' }] },
      { day: 'jeudi', label: 'Jeudi', morning: '20-30 min cardio Zone 2 (optionnel)', midday: '', session: null, sessionTime: 'Repos musculation', blocks: [{ type: 'cardio', durationMin: 25, optional: true }] },
      { day: 'vendredi', label: 'Vendredi', morning: '', midday: '', session: 'fullBodyC', sessionTime: 'Séance libre dans la journée', blocks: [{ type: 'training', sessionKey: 'fullBodyC' }] },
      { day: 'samedi', label: 'Samedi', morning: '', midday: '', session: null, sessionTime: 'Repos ou activité légère au choix', blocks: [] },
      { day: 'dimanche', label: 'Dimanche', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: '—', blocks: [] },
    ],
    notes: [
      "48h minimum entre deux séances full body pour laisser récupérer les mêmes groupes musculaires.",
      "Le cardio Zone 2 (mardi/jeudi) est optionnel les 4 premières semaines si la récupération est difficile — priorité à la musculation pendant l'apprentissage technique.",
    ],
  },

  // Full body → no fasted-cardio requirement, mild gap recommendation only.
  schedulingRules: { fastedCardioMorning: false, minGapHoursCardioToTraining: 3, qualityCardioMinGapBeforeLegsHours: null },

  sessions: {
    fullBodyA: {
      label: 'Full Body A',
      day: 'lundi',
      exercises: [
        { name: 'Squat gobelet ou barre', setsReps: '3 × 8-12', rest: '2 min', note: 'Base jambes' },
        { name: 'Développé couché barre ou haltères', setsReps: '3 × 8-12', rest: '2 min', note: '' },
        { name: 'Rowing barre ou machine', setsReps: '3 × 8-12', rest: '90s', note: '' },
        { name: 'Développé militaire haltères', setsReps: '2 × 10-12', rest: '90s', note: '' },
        { name: 'Curl biceps', setsReps: '2 × 10-15', rest: '60s', note: '' },
        { name: 'Planche (gainage)', setsReps: '3 × 20-40s', rest: '45s', note: '' },
      ],
    },
    fullBodyB: {
      label: 'Full Body B',
      day: 'mercredi',
      exercises: [
        { name: 'Soulevé de terre roumain haltères', setsReps: '3 × 8-12', rest: '2 min', note: 'Ischios + fessiers' },
        { name: 'Tirage vertical (lat pulldown)', setsReps: '3 × 8-12', rest: '90s', note: '' },
        { name: 'Développé incliné haltères', setsReps: '3 × 8-12', rest: '90s', note: '' },
        { name: 'Fentes marchées', setsReps: '2 × 10/jambe', rest: '90s', note: '' },
        { name: 'Extension triceps poulie', setsReps: '2 × 10-15', rest: '60s', note: '' },
        { name: 'Crunch ou relevé de jambes', setsReps: '3 × 12-15', rest: '45s', note: '' },
      ],
    },
    fullBodyC: {
      label: 'Full Body C',
      day: 'vendredi',
      exercises: [
        { name: 'Presse à cuisses', setsReps: '3 × 10-12', rest: '2 min', note: '' },
        { name: 'Rowing unilatéral haltère', setsReps: '3 × 10-12/côté', rest: '90s', note: '' },
        { name: 'Dips assistés ou pompes lestées', setsReps: '3 × 8-12', rest: '90s', note: '', bodyweightExercise: true },
        { name: 'Élévations latérales', setsReps: '2 × 12-15', rest: '60s', note: '' },
        { name: 'Curl marteau', setsReps: '2 × 10-15', rest: '60s', note: '' },
        { name: 'Mollets debout', setsReps: '3 × 15-20', rest: '60s', note: '' },
      ],
    },
  },

  weeklyVolume: [
    { group: 'Jambes (quadriceps/ischios/fessiers)', sets: '9-11', zone: '10-18' },
    { group: 'Pecs', sets: '6-8', zone: '10-20' },
    { group: 'Dos', sets: '9-11', zone: '14-22' },
    { group: 'Épaules', sets: '5-7', zone: '12-22' },
    { group: 'Bras (biceps/triceps)', sets: '4-6 chacun', zone: '8-16' },
    { group: 'Abdos', sets: '6-8', zone: '—' },
  ],
  weeklyVolumeNote: "Volume volontairement en-dessous du plafond optimal (Schoenfeld 2016) — un débutant progresse déjà à volume modéré ; monter le volume trop vite est la cause n°1 de blessure/abandon chez les débutants.",

  cardioProgram: [
    { block: 'Semaines 1-4', course: '2x/sem, 20-25 min Zone 2 (optionnel)', velo: '—', logique: 'Priorité à la technique en musculation' },
    { block: 'Semaines 5-12', course: '2-3x/sem, 25-30 min Zone 2', velo: 'Alternative possible à la course', logique: 'Base cardiovasculaire, santé générale' },
  ],
  cardioRule: 'Le cardio ne doit jamais empiéter sur la récupération des séances full body — en cas de fatigue, sauter le cardio avant de sauter la musculation.',

  agilityMobility: [
    { title: 'Avant chaque séance (5-10 min) — Échauffement articulaire', items: ['Rotations épaules/hanches/chevilles : 1 × 8-10/articulation', 'Squats au poids du corps : 1 × 10', 'Montées de genoux + talons-fesses : 20m chacun'] },
    { title: 'Après chaque séance (5 min) — Étirements légers', items: ['Chaîne postérieure : 2 × 20-30s', 'Chaîne antérieure : 2 × 20-30s'] },
  ],

  nutrition: {
    objective: 'Apport suffisant pour soutenir l\'apprentissage technique et la récupération, sans complexité inutile',
    intro: "À ce stade, la priorité est la régularité de l'apport protéique et un léger surplus ou le maintien calorique — pas une optimisation fine des macros.",
    strategyByBodyfat: [
      { condition: 'Débutant en musculation, poids stable souhaité', strategy: 'Calories de maintenance, répatries sur 3-4 repas réguliers.' },
      { condition: 'Objectif prise de muscle visible', strategy: 'Léger surplus (+150-250 kcal/jour) — un débutant peut prendre du muscle même en léger surplus grâce à "l\'effet débutant".' },
    ],
    macros: {
      proteinPerKg: '1.6-1.8 g/kg de poids de corps',
      proteinNote: 'Suffisant pour la synthèse protéique chez un débutant (Helms et al., 2014) — pas besoin du haut de la fourchette à ce stade.',
      carbsPerKg: '3-5 g/kg',
      carbsNote: "Énergie pour les séances et la récupération.",
      fatPerKg: '0.8-1 g/kg',
      fatNote: 'Fonction hormonale de base.',
      calorieRule: 'Ajuster selon l\'objectif (maintien ou léger surplus) — réévaluer après 4 semaines selon le poids et les sensations.',
    },
  },

  cognitivePerformance: {
    intro: "Les bénéfices cognitifs de l'exercice s'appliquent dès les premières semaines, pas seulement à haut volume :",
    points: [
      "Le cardio Zone 2 et la musculation élèvent tous deux le BDNF, favorable à la mémoire et à l'apprentissage.",
      "Un sommeil de 7-9h reste la variable la plus importante pour progresser, quel que soit le niveau.",
    ],
    conclusion: "À ce stade, la meilleure stratégie cognitive et physique est la même : la constance sur les fondamentaux plutôt que l'intensité maximale.",
  },

  monitoring: {
    autoRegulation: [
      { range: 'Score ≥ 70', action: 'Séance complète comme prévu' },
      { range: 'Score 50-69', action: 'Réduire légèrement les charges, garder le nombre de séries' },
      { range: 'Score < 50', action: 'Repos ou marche légère seulement' },
    ],
    alertSignals: [
      'Douleur articulaire (pas juste des courbatures) persistant plus de 3 jours',
      'Fatigue générale qui ne s\'améliore pas après une nuit de sommeil correcte',
      'Perte de motivation marquée sur plus d\'une semaine',
    ],
    alertRule: 'Un seul signal suffit à ce stade pour prendre 2-3 jours de repos complet — mieux vaut ralentir tôt que se blesser ou abandonner.',
  },

  limits: [
    "Les gains de débutant (« newbie gains ») sont réels mais temporaires — profiter de cette fenêtre avec de la constance plutôt que de la brûler avec un volume trop élevé trop vite.",
    "La technique prime sur la charge pendant les 4-6 premières semaines — mieux vaut un mouvement propre à charge légère qu'un mouvement dégradé à charge lourde.",
    "Ce programme est un point de départ, pas un plan à suivre indéfiniment — après 8-12 semaines, une progression vers plus de volume/spécialisation (comme le Programme Extrême) devient pertinente.",
  ],
};
