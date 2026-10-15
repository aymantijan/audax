// Gentle exercise sessions (chantier 7, S9): short, guided, no equipment but
// a chair and a wall. For every age; nothing here replaces a physiotherapist.
// Each step: { name, how, seconds }. Tested in tests/care.test.mjs.

export const GENTLE_SAFETY = 'Garde une chaise stable ou un mur à portée de main. Respire normalement. Arrête-toi en cas de douleur, de vertige ou d’essoufflement inhabituel. Si tu as une maladie du cœur, des os ou une opération récente, demande d’abord l’avis de ton médecin.';

export const GENTLE_ROUTINES = [
  {
    id: 'walk', name: 'Marche douce', level: 'Facile', icon: 'footprints',
    desc: 'Marcher à son rythme, dedans ou dehors.',
    steps: [
      { name: 'Échauffement', how: 'Marche lentement, les bras relâchés.', seconds: 120 },
      { name: 'Marche à ton rythme', how: 'Un peu plus vite, mais tu dois pouvoir parler sans être essoufflé·e.', seconds: 600 },
      { name: 'Retour au calme', how: 'Ralentis petit à petit.', seconds: 120 },
    ],
  },
  {
    id: 'balance', name: 'Équilibre', level: 'Facile', icon: 'scale',
    desc: 'Moins de chutes : 5 minutes, une main près d’une chaise.',
    steps: [
      { name: 'Debout, pieds joints', how: 'Tiens-toi droit·e, une main près du dossier de la chaise. Regarde devant toi.', seconds: 30 },
      { name: 'Sur la pointe des pieds', how: 'Monte doucement sur la pointe des pieds, redescends. Recommence 10 fois.', seconds: 45 },
      { name: 'Sur le pied droit', how: 'Lève le pied gauche de quelques centimètres. Tiens la chaise si besoin.', seconds: 30 },
      { name: 'Sur le pied gauche', how: 'Lève le pied droit de quelques centimètres.', seconds: 30 },
      { name: 'Marche talon-pointe', how: 'Le long d’un mur : pose le talon juste devant les orteils de l’autre pied, comme sur une ligne. 10 pas.', seconds: 60 },
      { name: 'Transfert de poids', how: 'Pieds écartés, balance doucement le poids du corps à droite, puis à gauche.', seconds: 45 },
      { name: 'Repos', how: 'Assieds-toi et respire calmement.', seconds: 30 },
    ],
  },
  {
    id: 'mobility', name: 'Réveil articulaire', level: 'Facile', icon: 'sun',
    desc: 'Le matin, assis ou debout, pour dérouiller les articulations.',
    steps: [
      { name: 'Épaules', how: 'Fais tourner les épaules vers l’arrière, lentement, 10 fois.', seconds: 40 },
      { name: 'Nuque', how: 'Tourne la tête doucement à droite, puis à gauche, sans forcer. 5 fois de chaque côté.', seconds: 40 },
      { name: 'Poignets et mains', how: 'Fais des cercles avec les poignets, puis ouvre et ferme les mains.', seconds: 40 },
      { name: 'Ouvrir la poitrine', how: 'Assis·e, mains derrière la tête, écarte les coudes et inspire. Relâche en soufflant.', seconds: 40 },
      { name: 'Chevilles', how: 'Assis·e, fais des cercles avec chaque pied, puis pointe et flèche les orteils.', seconds: 60 },
      { name: 'Genoux', how: 'Assis·e, tends une jambe devant toi puis repose-la. Alterne, 10 fois.', seconds: 60 },
    ],
  },
  {
    id: 'chair', name: 'Renforcement sur chaise', level: 'Moyen', icon: 'armchair',
    desc: 'Garder la force des jambes et des bras pour se lever, porter, monter les marches.',
    steps: [
      { name: 'Assis-debout', how: 'Assis·e au bord de la chaise, lève-toi sans t’aider des mains si tu peux, puis rassieds-toi doucement. 8 à 10 fois.', seconds: 60 },
      { name: 'Repos', how: 'Respire.', seconds: 20 },
      { name: 'Pompes contre le mur', how: 'Mains à plat sur le mur à hauteur des épaules, plie les coudes puis repousse. 10 fois.', seconds: 60 },
      { name: 'Genoux levés', how: 'Assis·e, lève un genou vers la poitrine, repose. Alterne, 10 fois de chaque côté.', seconds: 60 },
      { name: 'Repos', how: 'Respire.', seconds: 20 },
      { name: 'Jambes tendues', how: 'Assis·e, tends une jambe et tiens 3 secondes. Alterne, 8 fois de chaque côté.', seconds: 60 },
      { name: 'Montées sur pointes', how: 'Debout derrière la chaise, monte sur la pointe des pieds. 12 fois.', seconds: 45 },
      { name: 'Bras au-dessus de la tête', how: 'Avec deux bouteilles d’eau ou sans rien, monte les bras puis redescends. 10 fois.', seconds: 45 },
    ],
  },
  {
    id: 'stretch', name: 'Étirements du soir', level: 'Facile', icon: 'moon',
    desc: 'Relâcher le corps avant de dormir.',
    steps: [
      { name: 'Côtés', how: 'Debout ou assis·e, lève un bras et penche-toi doucement de l’autre côté. Change de côté à mi-temps.', seconds: 60 },
      { name: 'Arrière des jambes', how: 'Assis·e, une jambe tendue devant toi, penche-toi un peu en avant, dos droit. Change à mi-temps.', seconds: 60 },
      { name: 'Épaules', how: 'Passe un bras devant la poitrine et tiens-le avec l’autre main. Change à mi-temps.', seconds: 60 },
      { name: 'Mollets', how: 'Mains au mur, une jambe en arrière, talon au sol. Change à mi-temps.', seconds: 60 },
      { name: 'Dos', how: 'Assis·e, arrondis le dos en soufflant, puis redresse-toi en inspirant. Lentement.', seconds: 60 },
    ],
  },
  {
    id: 'breath', name: 'Respiration calme', level: 'Facile', icon: 'wind',
    desc: 'Cinq minutes pour faire baisser le stress.',
    steps: [
      { name: 'S’installer', how: 'Assis·e confortablement, les pieds au sol, les mains sur le ventre.', seconds: 30 },
      { name: 'Respirer lentement', how: 'Inspire par le nez en comptant jusqu’à 4, souffle par la bouche en comptant jusqu’à 6. Le ventre se gonfle puis se vide.', seconds: 210 },
      { name: 'Revenir', how: 'Respire normalement. Remarque comment tu te sens.', seconds: 60 },
    ],
  },
];

export const routineMinutes = (r) => Math.max(1, Math.round(r.steps.reduce((a, s) => a + s.seconds, 0) / 60));
