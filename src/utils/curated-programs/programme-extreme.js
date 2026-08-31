// ─────────────────────────────────────────────────────────────────────────────
// CURATED PROGRAM — "Programme d'Entraînement Extrême"
// Imported verbatim (structured, not generated) from a user-supplied PDF.
// Curated programs are read-only by design (see curated-programs/index.js
// header) — a user who wants to change an exercise saves a *variant*
// (healthStore.saveProgramVariant) instead of editing this file.
//
// v2 (2026-08-29): full re-import from an updated PDF. Real content changes
// vs v1, not just wording: Saturday's session is now a PURE pull session
// (no leg-isolation exercises) — sessionKey renamed pullLegs2 → pull2 to
// match; Thursday's leg session absorbed the lost leg volume (Lying Leg
// Curl 3→4 sets, Standing Calf Raise 5→6 sets) to compensate; every
// exercise now carries an explicit `rpe` target; weekly volume per muscle
// group changed substantially (Shoulders/Biceps/Triceps/Forearms raised,
// Hamstrings/Calves-frequency down) with an explicit optimal/warning status
// per row; three sections are genuinely new (`splitRationale`, `warmupGuide`,
// `openItems`) and are rendered by dedicated (optional, guarded) sections in
// Programs.jsx — a curated program without them (e.g. programme-debutant.js)
// simply doesn't show those sections.
// ─────────────────────────────────────────────────────────────────────────────
export const PROGRAMME_EXTREME = {
  id: 'programme-extreme',
  name: "Programme d'Entraînement Extrême",
  subtitle: 'Force Maximale · Volume Musculaire Complet · Agilité & Mobilité',
  tags: ['force', 'hypertrophie', 'avancé', 'cardio', 'agilité', '5j/semaine'],
  designedFor: 'Homme, 25 ans — Casablanca, Maroc — Master 1 ISCAE',
  objective: 'Dépasser les standards naturels · maintenir 15% bodyfat · protéger le système nerveux',
  // Sleep-target floor (see getSleepLoadTarget in health-science.js): a
  // program this demanding warrants an elevated baseline even on days that
  // look "normal" relative to the user's OWN recent (already-high) average —
  // the athlete sleep literature (8-10h under high training load) applies to
  // the whole program, not just to days that spike above an already-extreme
  // norm. Programme Débutant deliberately has no floor — it doesn't warrant one.
  sleepFloor: { min: 8, max: 10 },
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
      body: "Faire du cardio ET de la force au maximum en même temps n'est pas gratuit physiologiquement. Voie mTOR (hypertrophie/force) ↔ Voie AMPK (endurance) : ces deux voies de signalisation cellulaire sont partiellement antagonistes (Baar, 2014). Wilson et al. 2012 (méta-analyse, 21 études) : l'interférence touche surtout la puissance et la force des jambes, et elle est minimisée si les séances sont séparées de 6h ou plus, avec un volume de cardio modéré en Zone 2 plutôt qu'intense. La structure de ce programme (cardio le matin à jeun, musculation plus tard dans la journée) respecte déjà cette règle — le programme garde cette séparation et gère le volume total intelligemment plutôt que de tout pousser à fond chaque jour.",
    },
    {
      title: '3. Ce programme est agressif',
      body: "Il est construit en blocs périodisés (pas « tout à fond tout le temps » — c'est justement l'erreur qui mène à la stagnation et à la blessure). Chaque bloc a un focus différent. C'est ce qui permet de progresser sur les 3 fronts sans se cramer.",
    },
    {
      title: '4. Il n\'existe pas de « confusion musculaire »',
      body: "Un muscle ne « reconnaît » pas un exercice et n'a pas besoin de nouveauté pour continuer à grossir — il répond à la tension mécanique, au stress métabolique et à la surcharge progressive, rien de tout ça n'exige de variation constante. Deux choses SONT réelles : (1) des angles différents biaisent différentes zones du même muscle (déjà utilisé partout — ex. Curl incliné pour le chef long du biceps vs. Curl barre EZ pour le chef court), et (2) l'adaptation neurale à un exercice spécifique plafonne après plusieurs semaines, ce qui explique pourquoi les exercices tournent entre blocs plutôt que d'une semaine à l'autre. Faire tourner les exercices à chaque séance, en revanche, détruit la capacité à suivre la progression de charge — la variable la plus importante de toutes.",
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

  // Comparaison des splits — nouvelle section (v2) : pourquoi PPL plutôt
  // qu'une autre structure, et dans quel cas en changer.
  splitRationale: {
    intro: "Push/Pull/Legs n'est pas le seul split adapté à cet objectif — c'est une option solide parmi plusieurs. Voici la comparaison honnête :",
    table: [
      { split: 'Push/Pull/Legs (actuel, 5j)', frequency: '~2x/sem/muscle', bestFor: 'Volume élevé + stimulus hypertrophique maximal par séance', tradeoff: "Plus de types de séances à planifier (plus dur avec des horaires scolaires variables)" },
      { split: 'Upper/Lower (4j)', frequency: '~2x/sem/muscle', bestFor: 'Logistique plus simple, plus de récupération par séance — bon fit pour la Phase B', tradeoff: 'Séances plus longues (deux groupes musculaires majeurs combinés)' },
      { split: 'Full Body (3x/sem)', frequency: '3x/sem', bestFor: 'Fréquence maximale, bon pour un focus force pure', tradeoff: 'Ne peut pas caser le volume par muscle nécessaire pour une hypertrophie extrême' },
      { split: 'PHAT / PHUL (hybride Force+Hypertrophie)', frequency: '~2x/sem/muscle', bestFor: 'Construit explicitement pour "fort ET gros" — jours de force + jours d\'hypertrophie dans la même semaine', tradeoff: 'Plus complexe à programmer correctement' },
      { split: 'Bro Split (1 muscle/jour)', frequency: '~1x/sem', bestFor: 'Feeling bodybuilding traditionnel', tradeoff: 'Inférieur pour l\'hypertrophie à volume égal (recherche sur la fréquence, Schoenfeld) — non recommandé ici' },
    ],
    recommendation: "Recommandation : l'actuel hybride PPL 5 jours est un bon fit pour les Blocs 1-2 (focus volume). Pour le Bloc 3 (Force Max & Puissance), passer à une structure Upper/Lower vaut la peine d'être envisagé — des séances lourdes moins nombreuses et plus concentrées, avec plus de récupération entre elles, ce qui convient mieux au travail de force max à faibles répétitions. Ce n'est pas obligatoire, mais ça s'intègre naturellement dans la périodisation déjà en place : la structure peut changer entre blocs, tout comme l'intensité et le volume le font déjà.",
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
      { day: 'samedi', label: 'Samedi', morning: '7h00 Vélo Zone 2 — 30-35 min + Mobilité', midday: 'Libre', session: 'pull2', sessionTime: '12h-13h30', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'pull2' }] },
      { day: 'dimanche', label: 'Dimanche', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: '—', blocks: [] },
    ],
    phaseB: [
      { day: 'lundi', label: 'Lundi', morning: '6h40 Course Zone 2 — 25-30 min à jeun (léger, rapide)', midday: 'Cours (+ 30 min trajet chaque sens)', session: 'push1', sessionTime: '18h00-19h15 (jour court) / voir règle jour long', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'push1' }] },
      { day: 'mardi', label: 'Mardi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'pull1', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'pull1' }] },
      { day: 'mercredi', label: 'Mercredi', morning: 'REPOS COMPLET', midday: 'Cours ou libre', session: null, sessionTime: 'REPOS COMPLET', blocks: [] },
      { day: 'jeudi', label: 'Jeudi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'legs', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'legs' }] },
      { day: 'vendredi', label: 'Vendredi', morning: '6h40 Course Zone 2 — 25-30 min', midday: 'Cours', session: 'push2', sessionTime: '18h00-19h15', blocks: [{ type: 'cardio', durationMin: 25, fastedRecommended: true }, { type: 'training', sessionKey: 'push2' }] },
      { day: 'samedi', label: 'Samedi', morning: '7h00 Vélo Zone 2 — 30 min', midday: 'Libre', session: 'pull2', sessionTime: 'Horaire libre', blocks: [{ type: 'cardio', durationMin: 30, fastedRecommended: true }, { type: 'training', sessionKey: 'pull2' }] },
      { day: 'dimanche', label: 'Dimanche', morning: 'REPOS COMPLET', midday: 'REPOS COMPLET', session: null, sessionTime: '—', blocks: [] },
    ],
    notes: [
      "Pourquoi ne pas coller la musculation juste après le cardio à 7h30 : le corps a besoin d'environ 5h pour reconstituer le glycogène après une course à jeun — recharger avant de soulever lourd donne une meilleure performance et une meilleure prise de muscle. La liberté du télétravail rend ce délai facile à respecter. La salle ouvre à 7h30 : possible d'y aller directement après le réveil certains jours si l'emploi du temps l'exige, en gardant alors le cardio très léger ce jour-là (marche 15 min) pour éviter d'empiler la fatigue avant les charges lourdes.",
      "Pourquoi vélo le samedi et pas course : 4 sorties de course dans la semaine (lun/mar/jeu/ven) suffisent. Le vélo du samedi réduit l'impact articulaire cumulé sur les genoux/chevilles tout en gardant le volume cardio.",
      "Sur un jour court (sortie 16h15) : le trajet retour (30 min) laisse le temps de manger puis d'aller à la salle vers 18h. C'est le scénario par défaut ci-dessus.",
      "Règle pour les jours longs (sortie à 20h) — à appliquer jusqu'à ce que l'emploi du temps exact soit connu : garder uniquement le cardio Zone 2 le matin ce jour-là (pas de musculation avant les cours — la fenêtre 7h30-8h est trop courte pour une séance complète) ; pour la séance de musculation de ce jour, soit une séance courte en fin de soirée si la salle reste ouverte tard (à vérifier), soit un échange avec un jour normalement plus léger de la même semaine (jamais avec mercredi ou dimanche, qui restent des jours de repos complet). Une fois l'emploi du temps exact de l'ISCAE connu (fin septembre), le plan Phase B pourra être affiné jour par jour.",
    ],
  },

  // Nouvelle section (v2) : protocole d'échauffement, tempo et échelle RPE —
  // s'applique à toutes les séances de la Section « Séances détaillées »,
  // donc décrit une fois ici plutôt que répété exercice par exercice.
  warmupGuide: {
    generalWarmup: [
      "5-10 min d'échauffement général : cardio léger (vélo/rameur) + mobilité dynamique — déjà couvert par le protocole quotidien Agilité & Mobilité.",
      "Avant le PREMIER mouvement polyarticulaire lourd de la séance : 2-3 séries d'échauffement progressif (environ 40% → 60% → 80% du poids de travail visé, 5 reps chacune, 60-90s de repos) — non comptées dans les séries de travail des tableaux.",
      "Les exercices suivants pour le même groupe musculaire n'ont besoin que d'une série légère d'échauffement (barre à vide ou charge légère, 8-10 reps) avant les séries de travail.",
    ],
    tempoGuide: [
      { label: 'Séries hypertrophie (la plupart des exercices)', tempo: '3-1-1-0', detail: '3s de descente (excentrique), 1s de pause en étirement complet, 1s de montée (concentrique), pas de pause en haut — maximise le temps sous tension.' },
      { label: 'Mouvements polyarticulaires lourds (squat, développé couché, soulevé de terre)', tempo: '2-0-1-0', detail: 'Descente contrôlée, pas de rebond, poussée délibérée.' },
      { label: 'Bloc 3 (phase Puissance, plus tard dans le cycle)', tempo: 'Vitesse max intentionnelle', detail: "Concentrique effectué à vitesse maximale intentionnelle, peu importe la vitesse réelle de la charge — c'est comme ça que la puissance et l'explosivité s'entraînent." },
    ],
    rpeScale: [
      { rpe: 'RPE 7', meaning: '3 répétitions en réserve avant l\'échec' },
      { rpe: 'RPE 8', meaning: '2 répétitions en réserve' },
      { rpe: 'RPE 9', meaning: '1 répétition en réserve' },
      { rpe: 'RPE 10', meaning: "Échec réel — utilisé avec parcimonie, surtout pendant les semaines de test de force du Bloc 3" },
    ],
    restNote: "La colonne « Repos » de chaque tableau est le repos entre SÉRIES d'un MÊME exercice. En changeant d'exercice, ajouter 60-90 secondes en plus du dernier repos pour l'installation du matériel et la transition — c'est un temps logistique, en plus du (pas à la place du) repos entre séries.",
  },

  // Bloc 1 detailed sessions — exercises are free-text (loggable via
  // WorkoutLogging's custom-exercise field; French names kept verbatim).
  // `rpe` matches the RPE Scale in `warmupGuide.rpeScale` above.
  sessions: {
    push1: {
      label: 'PUSH 1 (Pecs / Épaules / Triceps / Abdos)',
      day: 'lundi',
      exercises: [
        { name: 'Développé couché barre', setsReps: '4 × 6-8', rest: '2-3 min', rpe: '7-8', note: 'Base force' },
        { name: 'Développé incliné haltères', setsReps: '4 × 8-10', rest: '2 min', rpe: '8', note: '' },
        { name: 'Dips lestés', setsReps: '3 × 8-12', rest: '2 min', rpe: '8', note: '', bodyweightExercise: true },
        { name: 'Écarté câble (poulie basse→haute)', setsReps: '3 × 12-15', rest: '60-90s', rpe: '9', note: 'Étirement pec' },
        { name: 'Développé militaire barre', setsReps: '4 × 6-8', rest: '2-3 min', rpe: '7-8', note: '' },
        { name: 'Élévations latérales', setsReps: '4 × 12-15', rest: '60s', rpe: '9', note: 'Deltoïde moyen' },
        { name: 'Lateral Raise Machine', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Technogym Selection Delts Machine — trajectoire guidée, tension constante sur toute l\'amplitude (contrairement aux haltères)' },
        { name: 'Extension triceps poulie haute', setsReps: '3 × 12-15', rest: '60s', rpe: '9', note: '' },
        { name: 'Barre au front (Skull Crushers)', setsReps: '3 × 10-12', rest: '90s', rpe: '8', note: "Longue portion, allongé — évite d'empiler un 2e mouvement de dips sur la même articulation d'épaule que les Dips lestés ci-dessus" },
        { name: 'Extension triceps unilatérale au-dessus de la tête', setsReps: '3 × 12-15', rest: '60s', rpe: '9', note: "Longue portion — position d'étirement au-dessus de la tête. Varie avec le 3e créneau de Push 2 (Dips triceps) ; Poulie + Extension restent fixes les deux jours pour le suivi de charge (18 séries/semaine au total)." },
        { name: 'Relevé de jambes suspendu', setsReps: '3 × 12-15', rest: '60s', rpe: '8', note: 'Abdos inférieurs', bodyweightExercise: true },
        { name: 'Gainage latéral (side plank)', setsReps: '3 × 30-45s/côté', rest: '45s', rpe: '—', note: 'Tenue — hanches hautes, ligne droite (obliques)', bodyweightExercise: true },
      ],
    },
    pull1: {
      label: 'PULL 1 (Dos / Biceps / Avant-bras / Nuque)',
      day: 'mardi',
      exercises: [
        { name: 'Tractions lestées', setsReps: '4 × 6-10', rest: '2-3 min', rpe: '8', note: 'Étirement complet en bas', bodyweightExercise: true },
        { name: 'Rowing barre buste penché', setsReps: '4 × 8-10', rest: '2 min', rpe: '8', note: 'Largeur du dos' },
        { name: 'Tirage horizontal câble', setsReps: '3 × 10-12', rest: '90s', rpe: '8', note: '' },
        { name: 'Rowing unilatéral haltère', setsReps: '3 × 10-12/côté', rest: '90s', rpe: '8', note: '' },
        { name: 'Face pull', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Santé épaule + deltoïde postérieur' },
        { name: 'Curl barre EZ', setsReps: '3 × 8-10', rest: '90s', rpe: '8', note: '' },
        { name: 'Curl incliné haltères', setsReps: '3 × 10-12', rest: '60s', rpe: '9', note: 'Étirement biceps (chef long)' },
        { name: 'Curl marteau', setsReps: '3 × 10-12', rest: '60s', rpe: '8-9', note: "Avant-bras + biceps. Même trio répété sur Pull 2 (18 séries/semaine au total)." },
        { name: 'Curl poignet (flexion/extension)', setsReps: '3 × 15-20 chaque', rest: '45s', rpe: '9', note: 'Avant-bras' },
        { name: 'Nuque (harnais, 4 directions)', setsReps: '3 × 15-20 × 4 dir.', rest: '45s', rpe: '8', note: 'Flexion/extension/latéral G-D' },
      ],
    },
    legs: {
      label: 'LEGS + ABDOS (Quadriceps / Ischios / Fessiers / Mollets)',
      day: 'jeudi',
      exercises: [
        { name: 'Squat barre', setsReps: '5 × 6-8', rest: '3 min', rpe: '7-8', note: 'Roi des exercices jambes' },
        { name: 'Presse à cuisses', setsReps: '4 × 10-12', rest: '2 min', rpe: '8', note: '' },
        { name: 'Soulevé de terre roumain', setsReps: '4 × 8-10', rest: '2-3 min', rpe: '8', note: 'Ischios + fessiers' },
        { name: 'Fentes marchées lestées', setsReps: '3 × 12/jambe', rest: '90s', rpe: '8', note: 'Unilatéral' },
        { name: 'Leg curl allongé', setsReps: '4 × 12-15', rest: '90s', rpe: '9', note: 'Passé de 3→4 séries pour compenser le volume perdu du samedi' },
        { name: 'Hip thrust barre', setsReps: '4 × 10-12', rest: '2 min', rpe: '8', note: 'Fessiers ciblés' },
        { name: 'Mollets debout', setsReps: '6 × 15-20', rest: '60s', rpe: '9', note: 'Passé de 5→6 séries — mollets maintenant entraînés seulement 1x/semaine' },
        { name: 'Mollets assis', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Soléaire' },
        { name: 'Abduction hanche câble (ou marche latérale élastique)', setsReps: '3 × 15-20/côté', rest: '45s', rpe: '7', note: 'Moyen fessier — stabilité du genou. Élastique léger seulement tant que le genou est symptomatique.' },
        { name: 'Crunch câble', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Abdos supérieurs' },
        { name: 'Woodchop câble', setsReps: '3 × 12-15/côté', rest: '60s', rpe: '8', note: 'Rotation depuis le buste, pas les bras (obliques)' },
      ],
    },
    push2: {
      label: 'PUSH 2 (Épaules focus / Pecs accessoire / Triceps)',
      day: 'vendredi',
      exercises: [
        { name: 'Développé militaire haltères', setsReps: '4 × 8-10', rest: '2 min', rpe: '8', note: '' },
        { name: 'Élévations latérales (tempo lent)', setsReps: '4 × 15-20', rest: '60s', rpe: '9', note: 'Volume deltoïde' },
        { name: 'Lateral Raise Machine', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Technogym Selection Delts Machine — même trajectoire guidée à tension constante que Push 1' },
        { name: 'Oiseau buste penché (rear delt fly)', setsReps: '4 × 15-20', rest: '60s', rpe: '9', note: '' },
        { name: 'Développé couché prise serrée', setsReps: '3 × 8-10', rest: '2 min', rpe: '8', note: 'Pecs + triceps' },
        { name: 'Écarté incliné haltères', setsReps: '3 × 12-15', rest: '90s', rpe: '9', note: '' },
        { name: 'Extension triceps poulie haute', setsReps: '3 × 12-15', rest: '60s', rpe: '9', note: '' },
        { name: 'Dips triceps (buste droit)', setsReps: '3 × 10-12', rest: '60-90s', rpe: '8-9', note: "3e créneau qui varie (Push 1 utilise Barre au front à la place, pour éviter deux mouvements de dips qui chargent la même épaule le même jour que les dips pecs)", bodyweightExercise: true },
        { name: 'Extension triceps unilatérale au-dessus de la tête', setsReps: '3 × 12-15', rest: '60s', rpe: '9', note: "Longue portion — position d'étirement au-dessus de la tête. Fixe les deux jours avec la Poulie haute pour le suivi de charge (18 séries/semaine au total)." },
      ],
    },
    pull2: {
      label: 'PULL 2 + ABDOS (Dos complet / Biceps / Avant-bras / Nuque / Lombaires)',
      day: 'samedi',
      exercises: [
        { name: 'Tirage vertical (lat pulldown)', setsReps: '4 × 10-12', rest: '90s', rpe: '8', note: 'Largeur du dos' },
        { name: 'Rowing T-bar', setsReps: '4 × 8-10', rest: '2 min', rpe: '8', note: 'Épaisseur du dos' },
        { name: 'Rowing buste soutenu (chest-supported)', setsReps: '3 × 10-12', rest: '90s', rpe: '8', note: 'Strict, sans élan' },
        { name: 'Oiseau poulie (reverse pec-deck)', setsReps: '3 × 15-20', rest: '60s', rpe: '9', note: 'Deltoïde postérieur' },
        { name: 'Shrugs barre', setsReps: '3 × 12-15', rest: '90s', rpe: '8', note: 'Trapèzes' },
        { name: 'Curl barre EZ', setsReps: '3 × 8-10', rest: '90s', rpe: '8', note: '' },
        { name: 'Curl incliné haltères', setsReps: '3 × 10-12', rest: '60s', rpe: '9', note: 'Étirement biceps (chef long)' },
        { name: 'Curl marteau', setsReps: '3 × 10-12', rest: '60s', rpe: '8-9', note: 'Avant-bras + biceps. Même trio que Pull 1 (18 séries/semaine au total).' },
        { name: 'Curl poignet inversé (barre EZ)', setsReps: '3 × 15-20', rest: '45s', rpe: '9', note: 'Extenseurs de l\'avant-bras' },
        { name: 'Nuque (harnais, 4 directions)', setsReps: '3 × 15-20 × 4 dir.', rest: '45s', rpe: '8', note: '2e session nuque de la semaine — associée à Pull, pas à Push' },
        { name: 'Extension lombaire (légère)', setsReps: '3 × 12-15', rest: '60s', rpe: '7-8', note: "Contrôlé, ne pas hyperextendre (érecteurs du rachis)" },
        { name: 'Planche (gainage)', setsReps: '3 × 45-60s', rest: '60s', rpe: '—', note: 'Tenue, pas un nombre de reps', bodyweightExercise: true },
        { name: 'Ab wheel rollout', setsReps: '3 × 10-15', rest: '60s', rpe: '8', note: '' },
      ],
    },
  },

  // Volume hebdomadaire par groupe musculaire — chaque ligne porte maintenant
  // un statut explicite (optimal/attention) qui reflète le tableau détaillé
  // du PDF (Section 9), pas juste une comparaison brute avec la zone Schoenfeld.
  weeklyVolume: [
    { group: 'Pecs', sets: '14-16', zone: '10-20', status: 'optimal', note: '' },
    { group: 'Épaules (3 faisceaux)', sets: '24-28', zone: '12-22', status: 'attention', note: "Au-dessus de la zone optimale (monté de 18-22 — Lateral Raise Machine ajoutée les deux jours Push). Le faisceau latéral est petit, coût de fatigue systémique faible, tolère bien un volume élevé — pratique courante en bodybuilding pour la largeur d'épaules. Surveiller via le Readiness Score." },
    { group: 'Dos', sets: '17-20', zone: '14-22', status: 'optimal', note: '' },
    { group: 'Biceps', sets: '18', zone: '8-16', status: 'attention', note: "Au-dessus de la zone optimale moyenne — justifié par un historique d'entraînement personnel documenté à ce volume. Surveiller via le Readiness Score." },
    { group: 'Triceps', sets: '18', zone: '8-16', status: 'attention', note: "Au-dessus de la zone optimale moyenne — même logique que biceps. Surveiller via le Readiness Score." },
    { group: 'Avant-bras', sets: '7-9 direct + grip constant', zone: '—', status: 'optimal', note: "Monté de 4-6 — reverse wrist curl ajouté sur Pull 2" },
    { group: 'Quadriceps', sets: '11-13', zone: '10-18', status: 'optimal', note: 'Descendu de 13-15 — jambes maintenant 1x/semaine' },
    { group: 'Ischios', sets: '8-10', zone: '8-16', status: 'attention', note: "Bas de fourchette (descendu de 10-13 — plus de marge)" },
    { group: 'Fessiers', sets: '10-12', zone: '8-16', status: 'optimal', note: '' },
    { group: 'Mollets', sets: '9 (fréquence 1x)', zone: '8-16, fréquence 2x préférée', status: 'attention', note: 'Volume OK, fréquence descendue de 2x/semaine' },
    { group: 'Abdos', sets: '10-13 direct + gainage', zone: '—', status: 'optimal', note: '3x/semaine (Push 1, Legs, Pull 2)' },
    { group: 'Obliques', sets: '6 direct + indirect des compounds', zone: '8-16 (bas de fourchette acceptable)', status: 'optimal', note: 'Réparti entre Push 1 et Legs' },
    { group: 'Moyen fessier / Abducteurs', sets: '3 (léger, focus stabilité)', zone: '—', status: 'optimal', note: 'Focus prévention (prehab)' },
    { group: 'Lombaires / Érecteurs du rachis', sets: '3 direct + indirect (RDL/Squat)', zone: '—', status: 'optimal', note: '' },
    { group: 'Nuque', sets: '6 (2x/semaine)', zone: '4-8', status: 'optimal', note: '' },
  ],
  weeklyVolumeNote: "Fréquence de 2x/semaine par muscle = le sweet spot confirmé par la littérature (Schoenfeld et al., 2016, revue systématique de la fréquence d'entraînement).",
  // Paragraphes explicatifs supplémentaires (v2) — le raisonnement complet
  // derrière les principaux arbitrages de volume ci-dessus.
  weeklyVolumeNotes: [
    "Restructuré en jambes 1x/semaine : ça sacrifie une partie de l'avantage de fréquence spécifiquement pour quadriceps, ischios et mollets, puisque l'ancien travail d'accessoires jambes du samedi a disparu. Le volume quadriceps reste confortablement dans la zone. Ischios et mollets ont été augmentés directement dans l'unique séance du jeudi (Leg Curl 3→4 séries, Mollets debout 5→6 séries) pour compenser la majorité de la perte — les ischios restent au bas de la zone optimale sans marge, et les mollets gardent leur volume hebdomadaire mais perdent la fréquence 2x/semaine à laquelle ils répondent bien. Un avantage plausible vu le souci de genou actuel : moins de fréquence de charge hebdomadaire sur l'articulation du genou en attendant un bilan chez le kiné.",
    "Les abdos sont répartis 3x/semaine (Push 1, Legs, Pull 2) au lieu d'être entassés sur un seul jour — c'est une augmentation de fréquence pour ce groupe musculaire, pas une baisse, et ça colle bien avec la vitesse de récupération du gainage entre séances. Les obliques suivent la même logique, répartis entre Push 1 et Legs.",
    "Biceps et triceps montés à 18 séries/semaine : 2 des 3 exercices restent fixes les deux jours pour un suivi de charge facile (triceps : Poulie haute + Extension au-dessus de la tête ; biceps : Curl barre EZ + Curl marteau), tandis que le 3e créneau varie pour le triceps entre Push 1/Push 2 (Barre au front vs. Dips triceps, pour éviter que deux mouvements de dips chargent la même épaule le même jour que les dips pecs). Les biceps utilisent un trio identique les deux jours car il n'y a pas de conflit d'articulation équivalent là-bas. C'est au-dessus de la zone optimale moyenne de la population (8-16 séries), mais basé sur un historique d'entraînement personnel documenté à ce volume avec des séances lourdes. Deux points à garder en tête : (1) les développés et tirages polyarticulaires de ce programme ajoutent déjà un travail indirect biceps/triceps significatif en plus de ces 18 séries directes, donc la charge totale des bras est plus élevée que le chiffre ne le suggère ; (2) un volume élevé de curl/extension est un facteur connu de stress tendineux au coude (épicondylite/épitrochléite) — en cas de gêne au coude, retirer une série par exercice avant de retirer un exercice entièrement.",
    "Épaules montées à 24-28 séries/semaine avec l'ajout de la Lateral Raise Machine les deux jours Push. C'est significativement au-dessus de la zone optimale standard — accepté ici car le deltoïde latéral est petit, récupère vite, et tolère bien un volume élevé en pratique ; c'est standard dans une programmation de style bodybuilding qui priorise la largeur d'épaules. En cas de fatigue articulaire de l'épaule ou de gêne type conflit sous-acromial, c'est le premier endroit où réduire le volume.",
  ],

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
    { title: 'Bloc 3 uniquement — Puissance explosive (2x/semaine, jours non-jambes lourdes)', items: ['Squat sauté : 4 × 5', 'Développé lancer (medecine ball throw) : 4 × 5', 'Fentes sautées : 3 × 6/jambe', "(Optionnel, technique requise) Variantes d'haltérophilie : hang clean, push press — recommandé avec supervision technique au début ; développe une puissance corps-entier inégalée"] },
  ],

  nutrition: {
    objective: 'Maintenir/atteindre 15% de masse grasse',
    intro: "15% de bodyfat est un objectif de recomposition raisonnable et durable (la zone où les abdos commencent à se voir sans restriction extrême). La stratégie dépend du point de départ, mesuré via l'estimation Navy déjà disponible dans le Health Dashboard.",
    strategyByBodyfat: [
      { condition: 'Bodyfat actuel > 17-18%', strategy: 'Léger déficit calorique (-200 à -300 kcal/jour) pendant les Blocs 1-2, en gardant les protéines hautes pour préserver le muscle malgré le déficit.' },
      { condition: 'Bodyfat actuel proche de 15%', strategy: 'Recomposition à calories de maintenance (perte de gras et gain de muscle en parallèle, plus lent mais le plus élégant avec ce volume d\'entraînement).' },
      { condition: 'Bodyfat actuel < 13-14%', strategy: 'Léger surplus (+200-300 kcal) possible pendant les Blocs 1-2 pour maximiser l\'hypertrophie, avec un ajustement en Bloc 3 pour ne pas dépasser 15-16%.' },
    ],
    macros: {
      proteinPerKg: '2.0-2.2 g/kg de poids de corps',
      proteinNote: 'Haut de la fourchette car volume extrême, et protège la masse musculaire même en déficit — Helms et al., 2014.',
      carbsPerKg: '6-8 g/kg',
      carbsNote: 'Carburant pour les doubles séances quotidiennes.',
      fatPerKg: '0.8-1 g/kg',
      fatNote: 'Fonction hormonale, ne pas descendre en dessous.',
      calorieRule: 'Ajuster autour de la maintenance selon le scénario (Blocs 1-2) · Maintenance ± 0 en Bloc 3 (focus force/technique, pas le moment d\'être en déficit) · réévaluer à chaque bloc selon la progression du bodyfat mesurée.',
    },
  },

  cognitivePerformance: {
    intro: "L'idée d'un cerveau qui tourne à plein régime (mémoire nette, décisions rapides) est atteignable par des leviers validés scientifiquement, intégrés dans ce programme :",
    points: [
      'Le cardio Zone 2 stimule le BDNF et la neurogenèse hippocampique (mémoire, apprentissage) — Cotman & Berchtold, 2002.',
      'Le sommeil profond consolide la mémoire déclarative (cours, lectures) — non négociable, particulièrement en période d\'examens.',
      "La musculation elle-même élève le BDNF et l'IGF-1, bénéfiques pour la cognition en plus des gains physiques.",
      'Le surentraînement fait l\'inverse : cortisol chronique élevé = dégradation mesurable de la mémoire et de la concentration — Lupien et al., 2009. La périodisation en blocs et les semaines de deload de ce programme empêchent précisément cela.',
    ],
    conclusion: "Conséquence concrète pour cette phase étudiante : le sommeil et les semaines de deload ne sont pas des options « si le temps le permet » — ce sont les garde-fous qui protègent directement la capacité de travail intellectuel à l'ISCAE, pas seulement la récupération musculaire.",
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
    "Le temps est le facteur limitant, pas la volonté. Hypertrophie visible significative : 12-16 semaines minimum. Force notable (+15-20% sur les compounds) : 16-20 semaines. Ce n'est pas un programme « 6 semaines miracle » — c'est un système à répéter en cycles sur 1-2 ans pour des résultats qui dépassent vraiment la moyenne.",
    "Un lifter naturel a un plafond. Avec une génétique moyenne-bonne, un entraînement optimal et une nutrition parfaite : environ 0.5-1% de gain de masse musculaire par mois la première année, beaucoup moins ensuite (modèles de gain naturel, Lyle McDonald / Alan Aragon).",
    "Ce volume nécessite un sommeil irréprochable. 8h ou plus n'est plus optionnel à ce niveau de charge — c'est la variable qui déterminera si la progression se fait ou si la stagnation/blessure survient.",
    "Semaine 1-2 : une fatigue d'adaptation est normale. Si à la semaine 3 la fatigue reste en zone rouge, réduire un cran (retirer une séance cardio de qualité, garder seulement la Zone 2).",
  ],

  // Nouvelle section (v2) — pistes discutées/recherchées mais pas encore
  // intégrées au programme ci-dessus, en attente d'une décision finale.
  openItems: {
    intro: "Discutées et recherchées (équipement Fitness Park confirmé : lignes Technogym Selection + Hammer Strength) mais pas encore ajoutées au programme ci-dessus, en attente d'une décision finale :",
    items: [
      'Chest Press Machine ou Pec-Deck (Technogym Selection) comme mouvement compound/isolation pec supplémentaire sur Push 2',
      'Straight-Arm Pulldown (câble) sur Pull 2, pour ajouter un pattern d\'isolation du grand dorsal distinct des rowings existants',
      'Preacher Curl Machine (Technogym Pure Strength) comme swap possible pour un curl à charge libre, pour un suivi de forme/charge plus strict',
      'Farmer\'s Walk ou Plate Pinch Hold, pour ajouter un travail de grip/avant-bras dédié au-delà du curl poignet actuel',
    ],
  },
};
