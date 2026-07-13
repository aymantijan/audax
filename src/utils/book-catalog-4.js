// Extension du catalogue (v4) — fusionnée par readingsStore.seedCatalog(),
// qui déduplique par titre|auteur et respecte les suppressions de l'utilisateur.
// Deux volets :
//   A. AUTEURS MAROCAINS (exhaustif) — francophones, arabophones, penseurs, patrimoine
//   B. Bibliographies étendues des grands auteurs déjà présents au catalogue

export const BOOK_CATALOG_V4 = [
  // ═══════════════════════════════════════════════════════════════════════
  //  A. AUTEURS MAROCAINS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Tahar Ben Jelloun (Fès, 1944 — Prix Goncourt 1987) ──
  { title: 'Harrouda', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1973, pages: 192, popularity: 78, description: "Premier roman : Fès et Tanger à travers la figure d'une femme mythique." },
  { title: 'La Réclusion solitaire', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1976, pages: 168, popularity: 74, description: "Le monologue d'un travailleur immigré en exil." },
  { title: 'Moha le fou, Moha le sage', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1978, pages: 216, popularity: 76, description: 'La voix d\'un fou lucide qui dit la vérité de la société.' },
  { title: 'La Prière de l\'absent', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1981, pages: 260, popularity: 75, description: 'Un voyage initiatique à travers le Maroc.' },
  { title: 'L\'Écrivain public', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1983, pages: 224, popularity: 76, description: 'Récit autobiographique de la vocation d\'écrivain.' },
  { title: 'L\'Enfant de sable', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1985, pages: 209, popularity: 86, description: 'Une fille élevée en garçon par un père sans héritier mâle.' },
  { title: 'La Nuit sacrée', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1987, pages: 192, popularity: 88, description: 'Suite de L\'Enfant de sable — Prix Goncourt 1987.' },
  { title: 'Jour de silence à Tanger', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1990, pages: 128, popularity: 76, description: 'Les pensées d\'un vieil homme dans le Tanger déclinant.' },
  { title: 'Les Yeux baissés', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1991, pages: 300, popularity: 78, description: 'Une jeune Berbère entre son village et l\'émigration en France.' },
  { title: 'L\'Homme rompu', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1994, pages: 224, popularity: 77, description: 'Un fonctionnaire intègre face à la tentation de la corruption.' },
  { title: 'Les Raisins de la galère', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1996, pages: 160, popularity: 74, description: 'Une jeune beur révoltée dans la France des banlieues.' },
  { title: 'La Nuit de l\'erreur', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 1997, pages: 320, popularity: 75, description: 'La vengeance d\'une femme née une nuit maudite.' },
  { title: 'Le Racisme expliqué à ma fille', author: 'Tahar Ben Jelloun', genre: 'Essays', year: 1998, pages: 106, popularity: 82, description: 'Un dialogue pédagogique sur le racisme.' },
  { title: 'Cette aveuglante absence de lumière', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2001, pages: 228, popularity: 84, description: 'Le bagne de Tazmamart raconté de l\'intérieur — Prix Impac 2004.' },
  { title: 'L\'Islam expliqué aux enfants', author: 'Tahar Ben Jelloun', genre: 'Religion & Spirituality', year: 2002, pages: 128, popularity: 78, description: 'Une introduction claire et apaisée à l\'islam.' },
  { title: 'Partir', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2006, pages: 267, popularity: 82, description: 'Le rêve d\'exil de jeunes Marocains vers l\'Europe.' },
  { title: 'Sur ma mère', author: 'Tahar Ben Jelloun', genre: 'Memoir', year: 2008, pages: 256, popularity: 80, description: 'Le portrait de sa mère glissant dans la maladie.' },
  { title: 'Au pays', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2009, pages: 192, popularity: 77, description: 'Un retraité immigré rêve de rentrer au Maroc.' },
  { title: 'Le Bonheur conjugal', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2012, pages: 320, popularity: 77, description: 'Un couple raconte, chacun à sa manière, la faillite de son mariage.' },
  { title: 'Le Mariage de plaisir', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2016, pages: 288, popularity: 78, description: 'Une saga familiale née d\'un mariage temporaire.' },
  { title: 'La Punition', author: 'Tahar Ben Jelloun', genre: 'Memoir', year: 2018, pages: 176, popularity: 78, description: 'Son propre internement disciplinaire dans l\'armée en 1966.' },
  { title: 'Le Miel et l\'amertume', author: 'Tahar Ben Jelloun', genre: 'Literary Fiction', year: 2021, pages: 240, popularity: 76, description: 'Le drame d\'une famille de Tanger brisée par un secret.' },

  // ── Driss Chraïbi (1926–2007) ──
  { title: 'Le Passé simple', author: 'Driss Chraïbi', genre: 'Literary Fiction', year: 1954, pages: 272, popularity: 84, description: 'La révolte d\'un fils contre le père et la tradition — roman fondateur.' },
  { title: 'Les Boucs', author: 'Driss Chraïbi', genre: 'Literary Fiction', year: 1955, pages: 192, popularity: 79, description: 'La condition des immigrés nord-africains en France.' },
  { title: 'Succession ouverte', author: 'Driss Chraïbi', genre: 'Literary Fiction', year: 1962, pages: 208, popularity: 77, description: 'Le retour au Maroc pour l\'enterrement du père.' },
  { title: 'La Civilisation, ma Mère!...', author: 'Driss Chraïbi', genre: 'Literary Fiction', year: 1972, pages: 184, popularity: 82, description: 'L\'émancipation joyeuse d\'une mère marocaine.' },
  { title: 'Une enquête au pays', author: 'Driss Chraïbi', genre: 'Crime', year: 1981, pages: 192, popularity: 78, description: 'L\'inspecteur Ali entre modernité et monde rural.' },
  { title: 'La Mère du printemps (L\'Oum-er-Bia)', author: 'Driss Chraïbi', genre: 'Historical Fiction', year: 1982, pages: 216, popularity: 76, description: 'La conquête arabe du Maroc, vue des Berbères.' },
  { title: 'Naissance à l\'aube', author: 'Driss Chraïbi', genre: 'Historical Fiction', year: 1986, pages: 192, popularity: 74, description: 'Fresque de l\'expansion arabe jusqu\'en Andalousie.' },
  { title: 'L\'Inspecteur Ali', author: 'Driss Chraïbi', genre: 'Crime', year: 1991, pages: 216, popularity: 77, description: 'Le retour du célèbre inspecteur, entre Maroc et Occident.' },
  { title: 'L\'Homme du Livre', author: 'Driss Chraïbi', genre: 'Historical Fiction', year: 1994, pages: 128, popularity: 76, description: 'Une méditation romanesque sur le Prophète Muhammad.' },
  { title: 'Vu, lu, entendu', author: 'Driss Chraïbi', genre: 'Memoir', year: 1998, pages: 240, popularity: 75, description: 'Ses mémoires, du Maroc colonial à l\'exil.' },

  // ── Mohamed Choukri (1935–2003) ──
  { title: 'Le Pain nu', author: 'Mohamed Choukri', genre: 'Autobiography', year: 1982, pages: 156, popularity: 85, description: 'L\'enfance de faim et de violence à Tanger — chef-d\'œuvre longtemps censuré.' },
  { title: 'Le Temps des erreurs', author: 'Mohamed Choukri', genre: 'Autobiography', year: 1992, pages: 224, popularity: 81, description: 'La suite du Pain nu : l\'apprentissage tardif de la lecture.' },
  { title: 'Zoco Chico', author: 'Mohamed Choukri', genre: 'Literary Fiction', year: 1985, pages: 176, popularity: 76, description: 'La faune du petit marché de Tanger.' },
  { title: 'Paul Bowles, le reclus de Tanger', author: 'Mohamed Choukri', genre: 'Memoir', year: 1997, pages: 176, popularity: 76, description: 'Ses souvenirs de l\'écrivain américain à Tanger.' },
  { title: 'Jean Genet à Tanger', author: 'Mohamed Choukri', genre: 'Memoir', year: 1974, pages: 128, popularity: 76, description: 'Rencontres avec Jean Genet dans le Tanger interlope.' },
  { title: 'Le Fou des roses', author: 'Mohamed Choukri', genre: 'Literary Fiction', year: 1979, pages: 160, popularity: 73, description: 'Nouvelles des marges de Tanger.' },

  // ── Fatema Mernissi (1940–2015) ──
  { title: 'Beyond the Veil', author: 'Fatema Mernissi', genre: 'Politics & Current Events', year: 1975, pages: 200, popularity: 82, description: 'Genre et pouvoir dans la société musulmane — étude pionnière.' },
  { title: 'Le Harem politique : le Prophète et les femmes', author: 'Fatema Mernissi', genre: 'Religion & Spirituality', year: 1987, pages: 320, popularity: 83, description: 'Relecture féministe des origines de l\'islam.' },
  { title: 'Sultanes oubliées', author: 'Fatema Mernissi', genre: 'History', year: 1990, pages: 320, popularity: 80, description: 'Les femmes qui ont régné en terre d\'islam.' },
  { title: 'La Peur-modernité : conflit islam démocratie', author: 'Fatema Mernissi', genre: 'Politics & Current Events', year: 1992, pages: 240, popularity: 78, description: 'Islam et démocratie face à la peur du changement.' },
  { title: 'Rêves de femmes : une enfance au harem', author: 'Fatema Mernissi', genre: 'Memoir', year: 1994, pages: 256, popularity: 85, description: 'Son enfance dans un harem de Fès des années 1940.' },
  { title: 'Le Harem et l\'Occident', author: 'Fatema Mernissi', genre: 'Essays', year: 2001, pages: 240, popularity: 79, description: 'Le fantasme du harem chez les hommes d\'Orient et d\'Occident.' },

  // ── Abdellatif Laâbi (1942 — Prix Goncourt de la Poésie 2009) ──
  { title: 'Le Fond de la jarre', author: 'Abdellatif Laâbi', genre: 'Literary Fiction', year: 2002, pages: 240, popularity: 78, description: 'Une enfance dans la médina de Fès des années 1950.' },
  { title: 'Le Chemin des ordalies', author: 'Abdellatif Laâbi', genre: 'Literary Fiction', year: 1982, pages: 208, popularity: 76, description: 'Roman de la prison et de la torture des années de plomb.' },
  { title: 'Le Spleen de Casablanca', author: 'Abdellatif Laâbi', genre: 'Essays', year: 1996, pages: 128, popularity: 74, description: 'Recueil de poèmes sur l\'exil et le retour.' },
  { title: 'L\'Œil et la nuit', author: 'Abdellatif Laâbi', genre: 'Literary Fiction', year: 1969, pages: 160, popularity: 72, description: 'Premier récit, écrit avant l\'emprisonnement.' },

  // ── Ahmed Sefrioui (1915–2004) ──
  { title: 'La Boîte à merveilles', author: 'Ahmed Sefrioui', genre: 'Literary Fiction', year: 1954, pages: 200, popularity: 85, description: 'L\'enfance à Fès vue par un petit garçon — classique scolaire.' },
  { title: 'Le Chapelet d\'ambre', author: 'Ahmed Sefrioui', genre: 'Literary Fiction', year: 1949, pages: 224, popularity: 76, description: 'Nouvelles de la vie traditionnelle marocaine.' },
  { title: 'La Maison de servitude', author: 'Ahmed Sefrioui', genre: 'Literary Fiction', year: 1973, pages: 208, popularity: 72, description: 'Un roman sur la condition et la mémoire.' },

  // ── Mohammed Khaïr-Eddine (1941–1995) ──
  { title: 'Agadir', author: 'Mohammed Khaïr-Eddine', genre: 'Literary Fiction', year: 1967, pages: 144, popularity: 76, description: 'La ville détruite par le séisme, dans une prose explosive.' },
  { title: 'Une odeur de mantèque', author: 'Mohammed Khaïr-Eddine', genre: 'Literary Fiction', year: 1976, pages: 176, popularity: 73, description: 'Roman de la révolte et de la "guérilla linguistique".' },
  { title: 'Il était une fois un vieux couple heureux', author: 'Mohammed Khaïr-Eddine', genre: 'Literary Fiction', year: 2002, pages: 176, popularity: 78, description: 'La sérénité d\'un couple âgé dans le Souss berbère.' },
  { title: 'Légende et vie d\'Agoun\'chich', author: 'Mohammed Khaïr-Eddine', genre: 'Literary Fiction', year: 1984, pages: 160, popularity: 73, description: 'La légende d\'un dernier hors-la-loi berbère.' },

  // ── Abdelkébir Khatibi (1938–2009) ──
  { title: 'La Mémoire tatouée', author: 'Abdelkébir Khatibi', genre: 'Literary Fiction', year: 1971, pages: 208, popularity: 76, description: 'Autobiographie d\'un "décolonisé" — texte majeur.' },
  { title: 'Amour bilingue', author: 'Abdelkébir Khatibi', genre: 'Literary Fiction', year: 1983, pages: 144, popularity: 75, description: 'L\'amour et l\'écriture entre deux langues.' },
  { title: 'Maghreb pluriel', author: 'Abdelkébir Khatibi', genre: 'Essays', year: 1983, pages: 208, popularity: 74, description: 'Essais sur la double critique et la pensée du Maghreb.' },
  { title: 'Le Livre du sang', author: 'Abdelkébir Khatibi', genre: 'Literary Fiction', year: 1979, pages: 176, popularity: 71, description: 'Roman mystique et poétique.' },

  // ── Abdelfattah Kilito (1945) ──
  { title: 'L\'Auteur et ses doubles', author: 'Abdelfattah Kilito', genre: 'Essays', year: 1985, pages: 208, popularity: 76, description: 'Essai sur la culture arabe classique et la notion d\'auteur.' },
  { title: 'Les Arabes et l\'art du récit', author: 'Abdelfattah Kilito', genre: 'Essays', year: 2009, pages: 200, popularity: 76, description: 'Une enquête savante et ludique sur la narration arabe.' },
  { title: 'Tu ne parleras pas ma langue', author: 'Abdelfattah Kilito', genre: 'Essays', year: 2008, pages: 128, popularity: 78, description: 'Réflexion brillante sur la langue et la traduction.' },
  { title: 'Je parle toutes les langues, mais en arabe', author: 'Abdelfattah Kilito', genre: 'Essays', year: 2013, pages: 144, popularity: 76, description: 'Variations sur le bilinguisme et l\'identité.' },

  // ── Fouad Laroui (1958 — Prix Goncourt de la nouvelle 2013) ──
  { title: 'Les Dents du topographe', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 1996, pages: 208, popularity: 78, description: 'Le retour ironique d\'un exilé dans le Maroc des années de plomb.' },
  { title: 'De quel amour blessé', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 1998, pages: 176, popularity: 75, description: 'Un Roméo et Juliette entre communautés à Casablanca.' },
  { title: 'Une année chez les Français', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 2010, pages: 288, popularity: 79, description: 'Un enfant boursier au lycée français de Casablanca.' },
  { title: 'L\'Étrange Affaire du pantalon de Dassoukine', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 2012, pages: 160, popularity: 79, description: 'Nouvelles — Prix Goncourt de la nouvelle 2013.' },
  { title: 'Les Tribulations du dernier Sijilmassi', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 2014, pages: 320, popularity: 78, description: 'Un ingénieur décide de tout quitter pour retrouver le sens.' },
  { title: 'Le Drame linguistique marocain', author: 'Fouad Laroui', genre: 'Essays', year: 2011, pages: 192, popularity: 76, description: 'Essai sur les langues et l\'école au Maroc.' },
  { title: 'Ce vain combat que tu livres au monde', author: 'Fouad Laroui', genre: 'Literary Fiction', year: 2016, pages: 240, popularity: 74, description: 'De l\'amour à la radicalisation, entre Paris et le Golfe.' },

  // ── Abdellah Taïa (1973 — Prix de Flore 2010) ──
  { title: 'L\'Armée du salut', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2006, pages: 154, popularity: 78, description: 'Récit d\'un jeune homosexuel de Salé à Genève.' },
  { title: 'Une mélancolie arabe', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2008, pages: 144, popularity: 76, description: 'Autofiction sur le désir et l\'exil.' },
  { title: 'Le Jour du roi', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2010, pages: 192, popularity: 79, description: 'Deux amis d\'enfance et le pouvoir royal — Prix de Flore.' },
  { title: 'Infidèles', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2012, pages: 192, popularity: 75, description: 'Un fils et sa mère prostituée dans le Maroc populaire.' },
  { title: 'Celui qui est digne d\'être aimé', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2017, pages: 144, popularity: 76, description: 'Un roman épistolaire sur l\'amour et la domination coloniale.' },
  { title: 'Vivre à ta lumière', author: 'Abdellah Taïa', genre: 'Literary Fiction', year: 2022, pages: 208, popularity: 76, description: 'La voix d\'une mère marocaine à travers l\'histoire du pays.' },

  // ── Leïla Slimani (1981 — Prix Goncourt 2016) ──
  { title: 'Dans le jardin de l\'ogre', author: 'Leïla Slimani', genre: 'Literary Fiction', year: 2014, pages: 240, popularity: 82, description: 'Une femme dévorée par l\'addiction sexuelle.' },
  { title: 'Chanson douce', author: 'Leïla Slimani', genre: 'Thriller & Suspense', year: 2016, pages: 240, popularity: 87, description: 'Une nounou parfaite bascule dans l\'horreur — Prix Goncourt.' },
  { title: 'Sexe et mensonges : la vie sexuelle au Maroc', author: 'Leïla Slimani', genre: 'Politics & Current Events', year: 2017, pages: 192, popularity: 80, description: 'Enquête sur la sexualité et la loi au Maroc.' },
  { title: 'Le Pays des autres', author: 'Leïla Slimani', genre: 'Historical Fiction', year: 2020, pages: 368, popularity: 84, description: 'Une Alsacienne et un Marocain après 1945 — saga en trois tomes.' },
  { title: 'Regardez-nous danser', author: 'Leïla Slimani', genre: 'Historical Fiction', year: 2022, pages: 368, popularity: 80, description: 'Le Maroc des années 1960-70, tome 2 de la trilogie.' },

  // ── Mahi Binebine (1959) ──
  { title: 'Cannibales', author: 'Mahi Binebine', genre: 'Literary Fiction', year: 1999, pages: 192, popularity: 79, description: 'Une nuit d\'attente de candidats à l\'émigration clandestine.' },
  { title: 'Les Étoiles de Sidi Moumen', author: 'Mahi Binebine', genre: 'Literary Fiction', year: 2010, pages: 192, popularity: 82, description: 'De l\'enfance du bidonville aux attentats de Casablanca 2003.' },
  { title: 'Le Fou du roi', author: 'Mahi Binebine', genre: 'Literary Fiction', year: 2017, pages: 160, popularity: 79, description: 'Le serviteur d\'un roi tout-puissant, entre Hassan II et fiction.' },
  { title: 'Rue du Pardon', author: 'Mahi Binebine', genre: 'Literary Fiction', year: 2019, pages: 160, popularity: 77, description: 'Une danseuse et une voyante dans la médina de Marrakech.' },

  // ── Bensalem Himmich (1948) ──
  { title: 'Le Calife de l\'épouvante', author: 'Bensalem Himmich', genre: 'Historical Fiction', year: 1989, pages: 320, popularity: 78, description: 'Le règne fou du calife fatimide al-Hakim (The Theocrat).' },
  { title: 'Le Polymathe', author: 'Bensalem Himmich', genre: 'Historical Fiction', year: 1997, pages: 288, popularity: 78, description: 'Les dernières années d\'Ibn Khaldoun au Caire.' },
  { title: 'Un homme des livres', author: 'Bensalem Himmich', genre: 'Historical Fiction', year: 2011, pages: 224, popularity: 74, description: 'Roman historique et érudit.' },

  // ── Youssouf Amine Elalamy (1961) ──
  { title: 'Les Clandestins', author: 'Youssouf Amine Elalamy', genre: 'Literary Fiction', year: 2000, pages: 160, popularity: 77, description: 'Le naufrage d\'une barque de harraga vers l\'Espagne.' },
  { title: 'Un Marocain à New York', author: 'Youssouf Amine Elalamy', genre: 'Literary Fiction', year: 1998, pages: 160, popularity: 74, description: 'Regard décalé sur l\'Amérique.' },
  { title: 'C\'est beau, la guerre', author: 'Youssouf Amine Elalamy', genre: 'Literary Fiction', year: 2006, pages: 144, popularity: 72, description: 'Fable poétique et satirique sur la guerre.' },

  // ── Abdelhak Serhane (1950) ──
  { title: 'Messaouda', author: 'Abdelhak Serhane', genre: 'Literary Fiction', year: 1983, pages: 224, popularity: 74, description: 'La violence et la sexualité dans un Maroc rural étouffant.' },
  { title: 'Les Enfants des rues étroites', author: 'Abdelhak Serhane', genre: 'Literary Fiction', year: 1986, pages: 208, popularity: 72, description: 'L\'enfance meurtrie dans une petite ville.' },

  // ── Mohamed Nedali (1962) ──
  { title: 'Morceaux de choix', author: 'Mohamed Nedali', genre: 'Literary Fiction', year: 2003, pages: 208, popularity: 75, description: 'Les amours d\'un apprenti boucher — humour et tendresse.' },
  { title: 'Le Bonheur des moineaux', author: 'Mohamed Nedali', genre: 'Literary Fiction', year: 2013, pages: 224, popularity: 74, description: 'Un couple face à l\'arbitraire et à la corruption.' },
  { title: 'Triste jeunesse', author: 'Mohamed Nedali', genre: 'Literary Fiction', year: 2012, pages: 240, popularity: 72, description: 'La jeunesse marocaine entre rêves et désillusions.' },

  // ── Laila Lalami (1968 — finaliste Pulitzer) ──
  { title: 'The Moor\'s Account', author: 'Laila Lalami', genre: 'Historical Fiction', year: 2014, pages: 336, popularity: 83, description: 'L\'expédition espagnole en Floride racontée par un esclave marocain.' },
  { title: 'Hope and Other Dangerous Pursuits', author: 'Laila Lalami', genre: 'Literary Fiction', year: 2005, pages: 195, popularity: 78, description: 'Quatre destins de migrants traversant le détroit de Gibraltar.' },
  { title: 'The Other Americans', author: 'Laila Lalami', genre: 'Literary Fiction', year: 2019, pages: 320, popularity: 80, description: 'La mort d\'un immigré marocain en Californie, et ses échos.' },
  { title: 'Secret Son', author: 'Laila Lalami', genre: 'Literary Fiction', year: 2009, pages: 291, popularity: 75, description: 'Un jeune de Casablanca découvre son père riche.' },
  { title: 'Conditional Citizens', author: 'Laila Lalami', genre: 'Politics & Current Events', year: 2020, pages: 208, popularity: 77, description: 'Essai sur l\'appartenance et la citoyenneté aux États-Unis.' },

  // ── Meryem Alaoui / Yasmine Chami / Réda Dalil / Mohamed Leftah ──
  { title: 'La Vérité sort de la bouche du cheval', author: 'Meryem Alaoui', genre: 'Literary Fiction', year: 2018, pages: 272, popularity: 78, description: 'La vie d\'une prostituée de Casablanca, drôle et vibrante.' },
  { title: 'Cérémonie', author: 'Yasmine Chami', genre: 'Literary Fiction', year: 1999, pages: 208, popularity: 73, description: 'Un mariage bourgeois de Fès comme miroir d\'une société.' },
  { title: 'Le Job', author: 'Réda Dalil', genre: 'Literary Fiction', year: 2014, pages: 224, popularity: 74, description: 'Un chômeur diplômé dans le Casablanca de la crise.' },
  { title: 'Le Dernier Combat du captain Ni\'mat', author: 'Mohamed Leftah', genre: 'Literary Fiction', year: 2011, pages: 160, popularity: 74, description: 'Le désir tardif d\'un officier égyptien à la retraite.' },
  { title: 'Demoiselles de Numidie', author: 'Mohamed Leftah', genre: 'Literary Fiction', year: 1992, pages: 176, popularity: 72, description: 'La nuit d\'un cabaret de Casablanca.' },

  // ── Rachid O. / Bahaa Trabelsi / Siham Benchekroun ──
  { title: 'L\'Enfant ébloui', author: 'Rachid O.', genre: 'Autobiography', year: 1995, pages: 128, popularity: 73, description: 'Récits d\'enfance et d\'éveil au désir.' },
  { title: 'Une femme tout simplement', author: 'Bahaa Trabelsi', genre: "Women's Fiction", year: 1995, pages: 176, popularity: 72, description: 'Le combat d\'une femme marocaine pour sa liberté.' },
  { title: 'Oser vivre', author: 'Siham Benchekroun', genre: "Women's Fiction", year: 1999, pages: 256, popularity: 73, description: 'L\'émancipation d\'une épouse et mère marocaine.' },

  // ── Pensée & sciences sociales : Mohammed Abed al-Jabri ──
  { title: 'Critique de la raison arabe : la formation de la raison arabe', author: 'Mohammed Abed al-Jabri', genre: 'Philosophy', year: 1984, pages: 400, popularity: 78, description: 'Takwin al-\'aql al-\'arabi — analyse magistrale de la pensée arabe.' },
  { title: 'La Structure de la raison arabe', author: 'Mohammed Abed al-Jabri', genre: 'Philosophy', year: 1986, pages: 592, popularity: 74, description: 'Bunyat al-\'aql al-\'arabi — les systèmes du savoir arabe.' },
  { title: 'La Raison politique arabe', author: 'Mohammed Abed al-Jabri', genre: 'Politics & Current Events', year: 1990, pages: 400, popularity: 73, description: 'Al-\'Aql al-siyasi al-\'arabi — tribu, butin et croyance.' },
  { title: 'Introduction à la critique de la raison arabe', author: 'Mohammed Abed al-Jabri', genre: 'Philosophy', year: 1994, pages: 208, popularity: 74, description: 'Une synthèse accessible de son grand projet critique.' },

  // ── Abdallah Laroui ──
  { title: 'L\'Idéologie arabe contemporaine', author: 'Abdallah Laroui', genre: 'Politics & Current Events', year: 1967, pages: 224, popularity: 76, description: 'Essai critique sur la pensée arabe moderne.' },
  { title: 'L\'Histoire du Maghreb : un essai de synthèse', author: 'Abdallah Laroui', genre: 'History', year: 1970, pages: 400, popularity: 77, description: 'Une relecture décolonisée de l\'histoire du Maghreb.' },
  { title: 'La Crise des intellectuels arabes', author: 'Abdallah Laroui', genre: 'Politics & Current Events', year: 1974, pages: 224, popularity: 74, description: 'Traditionalisme ou historicisme ?' },
  { title: 'Islam et modernité', author: 'Abdallah Laroui', genre: 'Politics & Current Events', year: 1987, pages: 176, popularity: 74, description: 'Réflexion sur la modernité en terre d\'islam.' },

  // ── Autres penseurs & romanciers arabophones ──
  { title: 'Autocritique (Al-Naqd al-dhati)', author: 'Allal al-Fassi', genre: 'Politics & Current Events', year: 1952, pages: 320, popularity: 72, description: 'Le grand texte du nationalisme et du réformisme marocains.' },
  { title: 'Le Jeu de l\'oubli', author: 'Mohamed Berrada', genre: 'Literary Fiction', year: 1987, pages: 192, popularity: 74, description: 'Lu\'bat al-nisyan — la mémoire d\'une famille de Fès.' },
  { title: 'La Femme et la rose', author: 'Mohamed Zafzaf', genre: 'Literary Fiction', year: 1972, pages: 176, popularity: 73, description: 'Un jeune Marocain en Espagne — grand nom du roman arabe.' },
  { title: 'Nous avons enterré le passé', author: 'Abdelkrim Ghallab', genre: 'Literary Fiction', year: 1966, pages: 288, popularity: 73, description: 'Dafanna al-madi — une famille de Fès et la lutte anticoloniale.' },
  { title: 'Les Voisines d\'Abou Moussa', author: 'Ahmed Toufiq', genre: 'Historical Fiction', year: 1997, pages: 256, popularity: 74, description: 'Marrakech au XVIIIe siècle autour d\'un saint soufi.' },
  { title: 'L\'Hôpital', author: 'Ahmed Bouanani', genre: 'Literary Fiction', year: 1990, pages: 144, popularity: 74, description: 'Un sanatorium comme huis clos onirique — culte et redécouvert.' },

  // ── Patrimoine : récits de voyage & histoire ──
  { title: 'Voyages (La Rihla)', author: 'Ibn Battuta', genre: 'Travel', year: 1355, pages: 400, popularity: 84, description: 'Trente ans de voyages du Maroc à la Chine — le plus grand voyageur médiéval.' },
  { title: 'Description de l\'Afrique', author: 'Léon l\'Africain', genre: 'History', year: 1550, pages: 512, popularity: 76, description: 'La géographie de l\'Afrique par Hassan al-Wazzan (Jean-Léon l\'Africain).' },

  // ═══════════════════════════════════════════════════════════════════════
  //  B. BIBLIOGRAPHIES ÉTENDUES DES AUTEURS EXISTANTS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Agatha Christie (Poirot & Marple, suite) ──
  { title: 'The Secret Adversary', author: 'Agatha Christie', genre: 'Mystery', year: 1922, pages: 336, popularity: 80, description: 'Tommy and Tuppence hunt a document that could topple governments.' },
  { title: 'Peril at End House', author: 'Agatha Christie', genre: 'Mystery', year: 1932, pages: 270, popularity: 81, description: 'Poirot senses a murder before it happens.' },
  { title: 'Lord Edgware Dies', author: 'Agatha Christie', genre: 'Mystery', year: 1933, pages: 256, popularity: 80, description: 'An actress with an unbreakable alibi.' },
  { title: 'Three Act Tragedy', author: 'Agatha Christie', genre: 'Mystery', year: 1934, pages: 256, popularity: 80, description: 'Poirot investigates deaths staged like theatre.' },
  { title: 'Cards on the Table', author: 'Agatha Christie', genre: 'Mystery', year: 1936, pages: 264, popularity: 82, description: 'Four sleuths, four suspects, one bridge game.' },
  { title: 'Appointment with Death', author: 'Agatha Christie', genre: 'Mystery', year: 1938, pages: 256, popularity: 82, description: 'A tyrannical matriarch dies at Petra.' },
  { title: 'Five Little Pigs', author: 'Agatha Christie', genre: 'Mystery', year: 1942, pages: 288, popularity: 84, description: 'Poirot reopens a murder sixteen years old.' },
  { title: 'Sparkling Cyanide', author: 'Agatha Christie', genre: 'Mystery', year: 1945, pages: 256, popularity: 80, description: 'A poisoning re-enacted a year later.' },
  { title: 'The Moving Finger', author: 'Agatha Christie', genre: 'Mystery', year: 1942, pages: 224, popularity: 81, description: 'Poison-pen letters lead to death — a Marple case.' },
  { title: 'A Pocket Full of Rye', author: 'Agatha Christie', genre: 'Mystery', year: 1953, pages: 224, popularity: 81, description: 'Murders that follow a nursery rhyme.' },
  { title: '4.50 from Paddington', author: 'Agatha Christie', genre: 'Mystery', year: 1957, pages: 256, popularity: 82, description: 'A murder glimpsed from a passing train — Miss Marple.' },
  { title: 'Endless Night', author: 'Agatha Christie', genre: 'Mystery', year: 1967, pages: 224, popularity: 82, description: 'A chilling standalone with a devastating twist.' },
  { title: 'Curtain: Poirot\'s Last Case', author: 'Agatha Christie', genre: 'Mystery', year: 1975, pages: 256, popularity: 84, description: 'The final, extraordinary case of Hercule Poirot.' },

  // ── Stephen King (suite) ──
  { title: 'The Dead Zone', author: 'Stephen King', genre: 'Thriller & Suspense', year: 1979, pages: 426, popularity: 84, description: 'A man wakes from a coma able to see the future.' },
  { title: 'Firestarter', author: 'Stephen King', genre: 'Science Fiction', year: 1980, pages: 428, popularity: 82, description: 'A girl with pyrokinesis hunted by a secret agency.' },
  { title: 'The Drawing of the Three', author: 'Stephen King', genre: 'Fantasy', year: 1987, pages: 400, popularity: 85, description: 'The Dark Tower II: Roland draws his ka-tet from our world.' },
  { title: 'The Waste Lands', author: 'Stephen King', genre: 'Fantasy', year: 1991, pages: 512, popularity: 85, description: 'The Dark Tower III.' },
  { title: 'Wizard and Glass', author: 'Stephen King', genre: 'Fantasy', year: 1997, pages: 672, popularity: 84, description: 'The Dark Tower IV: Roland\'s tragic first love.' },
  { title: 'Dolores Claiborne', author: 'Stephen King', genre: 'Literary Fiction', year: 1992, pages: 305, popularity: 82, description: 'A single-monologue confession of a hard island life.' },
  { title: 'Bag of Bones', author: 'Stephen King', genre: 'Horror', year: 1998, pages: 529, popularity: 82, description: 'A grieving novelist haunted at a lakeside house.' },
  { title: 'Revival', author: 'Stephen King', genre: 'Horror', year: 2014, pages: 405, popularity: 80, description: 'A preacher, electricity, and a terrible secret beyond death.' },
  { title: 'Mr. Mercedes', author: 'Stephen King', genre: 'Thriller & Suspense', year: 2014, pages: 448, popularity: 83, description: 'A retired cop hunts a mass-murderer — Edgar Award winner.' },
  { title: 'Billy Summers', author: 'Stephen King', genre: 'Thriller & Suspense', year: 2021, pages: 528, popularity: 83, description: 'A hitman with a code takes one last job.' },
  { title: 'Fairy Tale', author: 'Stephen King', genre: 'Fantasy', year: 2022, pages: 608, popularity: 81, description: 'A teenager inherits a portal to another world.' },

  // ── Naguib Mahfouz (compléter la Trilogie du Caire + majeurs) ──
  { title: 'Palace of Desire', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1957, pages: 448, popularity: 82, description: 'The Cairo Trilogy, book two.' },
  { title: 'Sugar Street', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1957, pages: 320, popularity: 82, description: 'The Cairo Trilogy, book three.' },
  { title: 'The Thief and the Dogs', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1961, pages: 158, popularity: 80, description: 'A released thief seeks revenge in a changed Egypt.' },
  { title: 'The Harafish', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1977, pages: 406, popularity: 80, description: 'Ten generations of a Cairo alley clan.' },
  { title: 'Children of Gebelawi', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1959, pages: 355, popularity: 79, description: 'An allegory of the prophets — long banned in Egypt.' },

  // ── Haruki Murakami (suite) ──
  { title: 'A Wild Sheep Chase', author: 'Haruki Murakami', genre: 'Magical Realism', year: 1982, pages: 353, popularity: 82, description: 'A quest for a sheep with a star on its back.' },
  { title: 'Dance Dance Dance', author: 'Haruki Murakami', genre: 'Magical Realism', year: 1988, pages: 393, popularity: 81, description: 'A return to the surreal Dolphin Hotel.' },
  { title: 'After Dark', author: 'Haruki Murakami', genre: 'Magical Realism', year: 2004, pages: 256, popularity: 80, description: 'One long Tokyo night between midnight and dawn.' },
  { title: 'Men Without Women', author: 'Haruki Murakami', genre: 'Literary Fiction', year: 2014, pages: 240, popularity: 80, description: 'Seven stories of solitude and loss.' },
  { title: 'Novelist as a Vocation', author: 'Haruki Murakami', genre: 'Memoir', year: 2015, pages: 240, popularity: 78, description: 'Reflections on the writing life.' },

  // ── Amin Maalouf (suite) ──
  { title: 'The Rock of Tanios', author: 'Amin Maalouf', genre: 'Historical Fiction', year: 1993, pages: 288, popularity: 82, description: 'A Lebanese mountain legend — Prix Goncourt 1993.' },
  { title: 'Ports of Call', author: 'Amin Maalouf', genre: 'Historical Fiction', year: 1996, pages: 176, popularity: 78, description: 'A life caught between the Orient and Europe.' },
  { title: 'Balthasar\'s Odyssey', author: 'Amin Maalouf', genre: 'Historical Fiction', year: 2000, pages: 400, popularity: 79, description: 'A bookseller hunts a text said to reveal the end of the world.' },
  { title: 'Origins', author: 'Amin Maalouf', genre: 'Memoir', year: 2004, pages: 416, popularity: 79, description: 'The author traces his own scattered family across continents.' },
  { title: 'The Disordered World', author: 'Amin Maalouf', genre: 'Politics & Current Events', year: 2009, pages: 288, popularity: 78, description: 'On the crisis of civilizations.' },
  { title: 'Les Désorientés', author: 'Amin Maalouf', genre: 'Literary Fiction', year: 2012, pages: 528, popularity: 78, description: 'Des amis d\'enfance se retrouvent après la guerre du Liban.' },

  // ── Paulo Coelho (suite) ──
  { title: 'The Fifth Mountain', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 1996, pages: 245, popularity: 78, description: 'The prophet Elijah\'s trial of faith.' },
  { title: 'Manuscript Found in Accra', author: 'Paulo Coelho', genre: 'Self-Help & Personal Development', year: 2012, pages: 191, popularity: 76, description: 'Wisdom on the eve of a city\'s fall to the Crusaders.' },
  { title: 'Aleph', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 2010, pages: 279, popularity: 76, description: 'A spiritual journey on the Trans-Siberian railway.' },
  { title: 'The Winner Stands Alone', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 2008, pages: 400, popularity: 74, description: 'Obsession and ambition at the Cannes festival.' },
  { title: 'By the River Piedra I Sat Down and Wept', author: 'Paulo Coelho', genre: 'Romance', year: 1994, pages: 210, popularity: 77, description: 'Love and the sacred feminine.' },

  // ── Isaac Asimov (suite) ──
  { title: 'The Robots of Dawn', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1983, pages: 419, popularity: 81, description: 'Baley and Daneel solve the murder of a humaniform robot.' },
  { title: 'Robots and Empire', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1985, pages: 384, popularity: 80, description: 'The bridge between the Robot and Foundation sagas.' },
  { title: 'Forward the Foundation', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1993, pages: 417, popularity: 81, description: 'Hari Seldon completes psychohistory as the Empire decays.' },
  { title: 'Pebble in the Sky', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1950, pages: 223, popularity: 78, description: 'His first novel — a tailor flung into the far future.' },
  { title: 'Nemesis', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1989, pages: 386, popularity: 77, description: 'A colony orbits a hidden star near Earth.' },

  // ── Milan Kundera (suite) ──
  { title: 'Immortality', author: 'Milan Kundera', genre: 'Literary Fiction', year: 1990, pages: 345, popularity: 79, description: 'A novel of gestures, images, and the self.' },
  { title: 'Slowness', author: 'Milan Kundera', genre: 'Literary Fiction', year: 1995, pages: 156, popularity: 76, description: 'Two seductions, two centuries, one château.' },
  { title: 'Ignorance', author: 'Milan Kundera', genre: 'Literary Fiction', year: 2000, pages: 195, popularity: 78, description: 'Two émigrés return to a Prague they no longer know.' },

  // ── Hermann Hesse (suite) ──
  { title: 'The Journey to the East', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1932, pages: 118, popularity: 78, description: 'A pilgrimage of the spirit through time and place.' },
  { title: 'Peter Camenzind', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1904, pages: 176, popularity: 74, description: 'His first novel — a young man\'s search for meaning.' },

  // ── Jean-Paul Sartre (suite) ──
  { title: 'The Age of Reason', author: 'Jean-Paul Sartre', genre: 'Literary Fiction', year: 1945, pages: 397, popularity: 78, description: 'Roads to Freedom I: a philosophy teacher\'s crisis in 1938 Paris.' },
  { title: 'Words', author: 'Jean-Paul Sartre', genre: 'Memoir', year: 1964, pages: 160, popularity: 79, description: 'His childhood among books — the memoir that won the Nobel he refused.' },

  // ── Naguib / Le Guin / Atwood / Camus completions ──
  { title: 'The Farthest Shore', author: 'Ursula K. Le Guin', genre: 'Fantasy', year: 1972, pages: 259, popularity: 82, description: 'Earthsea book three: magic drains from the world.' },
  { title: 'Tehanu', author: 'Ursula K. Le Guin', genre: 'Fantasy', year: 1990, pages: 226, popularity: 79, description: 'Earthsea book four, from a woman\'s point of view.' },
  { title: 'The Robber Bride', author: 'Margaret Atwood', genre: 'Literary Fiction', year: 1993, pages: 560, popularity: 79, description: 'Three women haunted by a manipulative friend.' },
  { title: 'The Penelopiad', author: 'Margaret Atwood', genre: 'Literary Fiction', year: 2005, pages: 199, popularity: 79, description: 'The Odyssey retold by Penelope from the underworld.' },
  { title: 'A Happy Death', author: 'Albert Camus', genre: 'Literary Fiction', year: 1971, pages: 192, popularity: 76, description: 'An early novel, precursor to The Stranger.' },
  { title: 'The Just', author: 'Albert Camus', genre: 'Literary Fiction', year: 1949, pages: 128, popularity: 74, description: 'A play about revolutionaries and the ethics of killing.' },

  // ── Dostoevsky / Tolstoy completions ──
  { title: 'The House of the Dead', author: 'Fyodor Dostoevsky', genre: 'Literary Fiction', year: 1862, pages: 384, popularity: 79, description: 'A fictionalized account of Siberian prison camp.' },
  { title: 'The Double', author: 'Fyodor Dostoevsky', genre: 'Literary Fiction', year: 1846, pages: 160, popularity: 77, description: 'A clerk meets his exact and sinister double.' },
  { title: 'The Cossacks', author: 'Leo Tolstoy', genre: 'Literary Fiction', year: 1863, pages: 176, popularity: 77, description: 'A disillusioned nobleman among the Cossacks of the Caucasus.' },
  { title: 'Master and Man', author: 'Leo Tolstoy', genre: 'Literary Fiction', year: 1895, pages: 96, popularity: 77, description: 'A master and servant caught in a deadly snowstorm.' },
];
