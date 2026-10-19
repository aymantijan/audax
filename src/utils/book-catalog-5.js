// Extension du catalogue (v5) — fusionnée par readingsStore.seedCatalog(),
// qui déduplique par titre|auteur et respecte les suppressions de l'utilisateur.
// Trois genres « Finance » (reading-genres.js) :
//   A. Trading — méthode, psychologie, analyse technique, options, quantitatif
//   B. Finance & investissement — valeur, évaluation, marchés, histoire financière
//   C. Éducation financière — budget, épargne, dettes, retraite, indépendance

export const BOOK_CATALOG_V5 = [
  // ═══════════════════════════════════════════════════════════════════════
  //  A. TRADING
  // ═══════════════════════════════════════════════════════════════════════
  // Psychologie & discipline
  { title: 'The Mental Game of Trading', author: 'Jared Tendler', genre: 'Trading', year: 2021, pages: 288, popularity: 82, description: 'Identifier et corriger les erreurs émotionnelles : peur, avidité, tilt, excès de confiance.' },
  { title: 'Best Loser Wins', author: 'Tom Hougaard', genre: 'Trading', year: 2022, pages: 256, popularity: 80, description: "Pourquoi accepter de perdre vite est la compétence centrale du trader." },
  { title: 'The Daily Trading Coach', author: 'Brett N. Steenbarger', genre: 'Trading', year: 2009, pages: 400, popularity: 76, description: '101 leçons pour devenir son propre coach de trading.' },
  { title: 'Enhancing Trader Performance', author: 'Brett N. Steenbarger', genre: 'Trading', year: 2006, pages: 320, popularity: 72, description: "Appliquer les méthodes de la performance sportive au trading." },
  { title: 'Market Mind Games', author: 'Denise Shull', genre: 'Trading', year: 2011, pages: 288, popularity: 68, description: 'Utiliser ses émotions comme information plutôt que de les combattre.' },
  { title: 'Trade Your Way to Financial Freedom', author: 'Van K. Tharp', genre: 'Trading', year: 1998, pages: 400, popularity: 78, description: "Espérance mathématique, multiples de R et taille de position : bâtir son propre système." },
  // Systèmes & méthode
  { title: 'Way of the Turtle', author: 'Curtis Faith', genre: 'Trading', year: 2007, pages: 272, popularity: 77, description: "L'expérience des Turtles racontée de l'intérieur : des règles simples, suivies sans exception." },
  { title: 'The Complete TurtleTrader', author: 'Michael W. Covel', genre: 'Trading', year: 2007, pages: 256, popularity: 73, description: "Comment Richard Dennis a prouvé qu'on pouvait apprendre le trading à des débutants." },
  { title: 'Come Into My Trading Room', author: 'Alexander Elder', genre: 'Trading', year: 2002, pages: 320, popularity: 72, description: 'Psychologie, méthode, gestion du risque et tenue du journal de trading.' },
  { title: 'Mastering the Trade', author: 'John F. Carter', genre: 'Trading', year: 2005, pages: 432, popularity: 70, description: 'Configurations intraday et swing, avec leurs règles d\'entrée et de sortie.' },
  { title: 'How to Make Money in Stocks', author: "William J. O'Neil", genre: 'Trading', year: 1988, pages: 464, popularity: 80, description: 'La méthode CAN SLIM : croissance, volume et points d\'achat sur graphique.' },
  { title: 'Trade Like a Stock Market Wizard', author: 'Mark Minervini', genre: 'Trading', year: 2013, pages: 320, popularity: 79, description: 'Le modèle SEPA : tendance, contraction de volatilité et coupe des pertes.' },
  // Analyse technique & price action
  { title: 'Technical Analysis Using Multiple Timeframes', author: 'Brian Shannon', genre: 'Trading', year: 2008, pages: 200, popularity: 70, description: 'Aligner plusieurs unités de temps pour lire le cycle de marché.' },
  { title: 'The Art and Science of Technical Analysis', author: 'Adam Grimes', genre: 'Trading', year: 2012, pages: 480, popularity: 74, description: "Une analyse technique fondée sur les statistiques plutôt que sur le folklore." },
  { title: 'Evidence-Based Technical Analysis', author: 'David Aronson', genre: 'Trading', year: 2006, pages: 544, popularity: 66, description: 'Tester les règles techniques avec la méthode scientifique et éviter les faux résultats.' },
  { title: 'Encyclopedia of Chart Patterns', author: 'Thomas N. Bulkowski', genre: 'Trading', year: 2005, pages: 1032, popularity: 72, description: 'Les figures chartistes et leurs taux de réussite mesurés sur des milliers de cas.' },
  { title: 'Trading Price Action Trends', author: 'Al Brooks', genre: 'Trading', year: 2011, pages: 448, popularity: 70, description: 'Lire chaque bougie pour suivre les tendances sans indicateur.' },
  // Options & volatilité
  { title: 'Options as a Strategic Investment', author: 'Lawrence G. McMillan', genre: 'Trading', year: 1980, pages: 1072, popularity: 74, description: "La référence sur les stratégies d'options, de la plus simple à la plus complexe." },
  { title: 'Option Volatility and Pricing', author: 'Sheldon Natenberg', genre: 'Trading', year: 1988, pages: 592, popularity: 76, description: 'Volatilité, grecques et évaluation : comment pensent les teneurs de marché.' },
  // Quantitatif
  { title: 'Quantitative Trading', author: 'Ernest P. Chan', genre: 'Trading', year: 2008, pages: 204, popularity: 70, description: 'Monter seul une activité de trading algorithmique : idées, tests, exécution.' },
  { title: 'Algorithmic Trading', author: 'Ernest P. Chan', genre: 'Trading', year: 2013, pages: 224, popularity: 68, description: 'Stratégies de retour à la moyenne et de momentum, avec leurs pièges.' },
  { title: 'The Man Who Solved the Market', author: 'Gregory Zuckerman', genre: 'Trading', year: 2019, pages: 384, popularity: 80, description: 'Jim Simons et Renaissance Technologies, la révolution quantitative.' },
  // Récits de traders
  { title: 'Stock Market Wizards', author: 'Jack D. Schwager', genre: 'Trading', year: 2001, pages: 480, popularity: 74, description: 'Entretiens avec des traders d\'actions hors normes.' },
  { title: 'Hedge Fund Market Wizards', author: 'Jack D. Schwager', genre: 'Trading', year: 2012, pages: 528, popularity: 76, description: 'Quinze gérants de hedge funds expliquent leur méthode et leurs erreurs.' },
  { title: 'Pit Bull', author: 'Martin Schwartz', genre: 'Trading', year: 1998, pages: 304, popularity: 68, description: "Le parcours d'un champion de trading sur les contrats à terme." },
  { title: 'The Alchemy of Finance', author: 'George Soros', genre: 'Trading', year: 1987, pages: 416, popularity: 72, description: 'La théorie de la réflexivité et un journal de trading en temps réel.' },

  // ═══════════════════════════════════════════════════════════════════════
  //  B. FINANCE & INVESTISSEMENT
  // ═══════════════════════════════════════════════════════════════════════
  // Investissement dans la valeur
  { title: 'The Essays of Warren Buffett', author: 'Warren Buffett & Lawrence A. Cunningham', genre: 'Finance & Investing', year: 1997, pages: 368, popularity: 86, description: 'Les lettres aux actionnaires de Berkshire, classées par thème.' },
  { title: 'The Warren Buffett Way', author: 'Robert G. Hagstrom', genre: 'Finance & Investing', year: 1994, pages: 320, popularity: 76, description: 'Les principes de Buffett pour choisir une entreprise et son prix.' },
  { title: 'The Snowball', author: 'Alice Schroeder', genre: 'Finance & Investing', year: 2008, pages: 960, popularity: 80, description: 'La biographie de référence de Warren Buffett.' },
  { title: 'Margin of Safety', author: 'Seth A. Klarman', genre: 'Finance & Investing', year: 1991, pages: 249, popularity: 76, description: "L'investissement dans la valeur vu par un gérant prudent : éviter de perdre d'abord." },
  { title: 'You Can Be a Stock Market Genius', author: 'Joel Greenblatt', genre: 'Finance & Investing', year: 1997, pages: 320, popularity: 72, description: 'Scissions, restructurations, situations spéciales : là où le marché se trompe.' },
  { title: 'The Outsiders', author: 'William N. Thorndike Jr.', genre: 'Finance & Investing', year: 2012, pages: 272, popularity: 76, description: 'Huit dirigeants qui ont excellé dans l\'allocation du capital.' },
  { title: '100 Baggers', author: 'Christopher W. Mayer', genre: 'Finance & Investing', year: 2015, pages: 200, popularity: 70, description: 'Ce qu\'ont en commun les actions multipliées par cent.' },
  { title: 'Investing: The Last Liberal Art', author: 'Robert G. Hagstrom', genre: 'Finance & Investing', year: 2000, pages: 256, popularity: 66, description: 'Biologie, physique, psychologie : des modèles mentaux pour investir.' },
  // Évaluation & analyse financière
  { title: 'The Little Book of Valuation', author: 'Aswath Damodaran', genre: 'Finance & Investing', year: 2011, pages: 256, popularity: 74, description: "Évaluer une entreprise, des flux actualisés aux multiples, en version courte." },
  { title: 'Narrative and Numbers', author: 'Aswath Damodaran', genre: 'Finance & Investing', year: 2017, pages: 288, popularity: 70, description: 'Relier une histoire d\'entreprise à des chiffres, et l\'inverse.' },
  { title: 'Investment Valuation', author: 'Aswath Damodaran', genre: 'Finance & Investing', year: 1996, pages: 992, popularity: 70, description: "Le manuel complet d'évaluation d'actifs, tous types d'entreprises." },
  { title: 'Valuation: Measuring and Managing the Value of Companies', author: 'McKinsey & Company', genre: 'Finance & Investing', year: 1990, pages: 896, popularity: 70, description: 'Création de valeur, rentabilité du capital et évaluation par les flux.' },
  { title: 'Financial Shenanigans', author: 'Howard M. Schilit', genre: 'Finance & Investing', year: 1993, pages: 384, popularity: 68, description: 'Repérer les manipulations comptables dans les états financiers.' },
  { title: 'Principles of Corporate Finance', author: 'Richard A. Brealey, Stewart C. Myers & Franklin Allen', genre: 'Finance & Investing', year: 1981, pages: 976, popularity: 68, description: "Le manuel de finance d'entreprise : investissement, financement, risque." },
  // Marchés, risque & portefeuille
  { title: 'Stocks for the Long Run', author: 'Jeremy J. Siegel', genre: 'Finance & Investing', year: 1994, pages: 464, popularity: 74, description: 'Deux siècles de rendements : pourquoi les actions gagnent sur la durée.' },
  { title: 'Winning the Loser\'s Game', author: 'Charles D. Ellis', genre: 'Finance & Investing', year: 1985, pages: 288, popularity: 72, description: "Gagner en évitant les erreurs plutôt qu'en cherchant le coup parfait." },
  { title: 'The Four Pillars of Investing', author: 'William J. Bernstein', genre: 'Finance & Investing', year: 2002, pages: 352, popularity: 72, description: 'Théorie, histoire, psychologie et secteur financier : les bases d\'un portefeuille.' },
  { title: 'Expected Returns', author: 'Antti Ilmanen', genre: 'Finance & Investing', year: 2011, pages: 590, popularity: 62, description: "D'où viennent les rendements des actifs, et comment les anticiper." },
  { title: 'Against the Gods', author: 'Peter L. Bernstein', genre: 'Finance & Investing', year: 1996, pages: 400, popularity: 76, description: "L'histoire de la mesure du risque, des probabilités à la finance moderne." },
  { title: 'Irrational Exuberance', author: 'Robert J. Shiller', genre: 'Finance & Investing', year: 2000, pages: 336, popularity: 72, description: 'Bulles boursières et immobilières : comment l\'enthousiasme fausse les prix.' },
  { title: 'Your Money and Your Brain', author: 'Jason Zweig', genre: 'Finance & Investing', year: 2007, pages: 352, popularity: 68, description: 'Ce que les neurosciences disent de nos décisions d\'investissement.' },
  // Histoire & crises financières
  { title: 'The Ascent of Money', author: 'Niall Ferguson', genre: 'Finance & Investing', year: 2008, pages: 448, popularity: 76, description: "Une histoire de la finance : crédit, obligations, actions, assurance." },
  { title: 'Manias, Panics, and Crashes', author: 'Charles P. Kindleberger', genre: 'Finance & Investing', year: 1978, pages: 384, popularity: 70, description: 'Les crises financières suivent toujours le même schéma.' },
  { title: 'This Time Is Different', author: 'Carmen M. Reinhart & Kenneth S. Rogoff', genre: 'Finance & Investing', year: 2009, pages: 512, popularity: 70, description: 'Huit siècles de crises de dette et de défauts souverains.' },
  { title: 'Lords of Finance', author: 'Liaquat Ahamed', genre: 'Finance & Investing', year: 2009, pages: 576, popularity: 72, description: 'Quatre banquiers centraux et la Grande Dépression.' },
  { title: 'When Genius Failed', author: 'Roger Lowenstein', genre: 'Finance & Investing', year: 2000, pages: 288, popularity: 76, description: "L'effondrement du fonds LTCM, géré par des prix Nobel." },
  { title: 'The Big Short', author: 'Michael Lewis', genre: 'Finance & Investing', year: 2010, pages: 320, popularity: 86, description: 'Ceux qui avaient vu venir la crise des subprimes de 2008.' },
  { title: 'Too Big to Fail', author: 'Andrew Ross Sorkin', genre: 'Finance & Investing', year: 2009, pages: 624, popularity: 76, description: 'Les coulisses de Wall Street et de Washington pendant la crise de 2008.' },
  { title: "Liar's Poker", author: 'Michael Lewis', genre: 'Finance & Investing', year: 1989, pages: 310, popularity: 76, description: 'La vie dans une salle de marché des années 1980.' },
  { title: 'Flash Boys', author: 'Michael Lewis', genre: 'Finance & Investing', year: 2014, pages: 288, popularity: 74, description: 'Le trading à haute fréquence et ceux qui l\'ont dénoncé.' },
  { title: 'Barbarians at the Gate', author: 'Bryan Burrough & John Helyar', genre: 'Finance & Investing', year: 1989, pages: 528, popularity: 72, description: 'Le rachat de RJR Nabisco, symbole des LBO des années 1980.' },

  // ═══════════════════════════════════════════════════════════════════════
  //  C. ÉDUCATION FINANCIÈRE
  // ═══════════════════════════════════════════════════════════════════════
  // Bases : budget, épargne, dettes
  { title: 'The Millionaire Next Door', author: 'Thomas J. Stanley & William D. Danko', genre: 'Personal Finance', year: 1996, pages: 272, popularity: 84, description: 'Les vrais riches vivent souvent simplement : enquête sur leurs habitudes.' },
  { title: 'Your Money or Your Life', author: 'Vicki Robin & Joe Dominguez', genre: 'Personal Finance', year: 1992, pages: 400, popularity: 78, description: "Convertir ses dépenses en heures de vie pour décider ce qui compte vraiment." },
  { title: 'The Total Money Makeover', author: 'Dave Ramsey', genre: 'Personal Finance', year: 2003, pages: 256, popularity: 80, description: "Sortir des dettes étape par étape, puis bâtir une épargne." },
  { title: 'The Automatic Millionaire', author: 'David Bach', genre: 'Personal Finance', year: 2003, pages: 272, popularity: 74, description: "Automatiser son épargne pour ne plus dépendre de sa volonté." },
  { title: 'The Latte Factor', author: 'David Bach & John David Mann', genre: 'Personal Finance', year: 2019, pages: 160, popularity: 66, description: 'Une fable courte sur les petites dépenses et le temps qui fait grossir l\'épargne.' },
  { title: 'The Index Card', author: 'Helaine Olen & Harold Pollack', genre: 'Personal Finance', year: 2016, pages: 256, popularity: 68, description: "Tout l'essentiel des finances personnelles tient sur une fiche." },
  { title: 'The Wealthy Barber', author: 'David Chilton', genre: 'Personal Finance', year: 1989, pages: 224, popularity: 70, description: "Les bases de l'argent racontées par un coiffeur de quartier." },
  { title: 'The Barefoot Investor', author: 'Scott Pape', genre: 'Personal Finance', year: 2016, pages: 272, popularity: 74, description: 'Un plan simple en étapes : comptes séparés, coussin de sécurité, dettes, retraite.' },
  { title: 'Get Good with Money', author: 'Tiffany Aliche', genre: 'Personal Finance', year: 2021, pages: 320, popularity: 70, description: 'Dix étapes pour gagner en sérénité financière.' },
  { title: 'Broke Millennial', author: 'Erin Lowry', genre: 'Personal Finance', year: 2017, pages: 272, popularity: 68, description: 'Budget, crédit et dettes étudiantes expliqués aux jeunes adultes.' },
  { title: 'The Money Book for the Young, Fabulous & Broke', author: 'Suze Orman', genre: 'Personal Finance', year: 2005, pages: 288, popularity: 66, description: 'Premiers revenus, premières dettes : les bons réflexes.' },
  { title: 'Women & Money', author: 'Suze Orman', genre: 'Personal Finance', year: 2007, pages: 288, popularity: 66, description: "Prendre le contrôle de ses finances et oser en parler." },
  // Investir simplement
  { title: "The Bogleheads' Guide to Investing", author: 'Taylor Larimore, Mel Lindauer & Michael LeBoeuf', genre: 'Personal Finance', year: 2006, pages: 352, popularity: 74, description: 'Fonds indiciels, frais bas, discipline : investir sans se compliquer la vie.' },
  { title: 'Just Keep Buying', author: 'Nick Maggiulli', genre: 'Personal Finance', year: 2022, pages: 304, popularity: 74, description: "Épargner puis investir régulièrement : des réponses chiffrées aux questions courantes." },
  { title: 'The Behavior Gap', author: 'Carl Richards', genre: 'Personal Finance', year: 2012, pages: 208, popularity: 64, description: "L'écart entre le rendement des fonds et celui des épargnants, expliqué en croquis." },
  { title: 'Money: Master the Game', author: 'Tony Robbins', genre: 'Personal Finance', year: 2014, pages: 688, popularity: 72, description: 'Sept étapes vers la liberté financière, nourries d\'entretiens avec de grands investisseurs.' },
  { title: 'Unshakeable', author: 'Tony Robbins', genre: 'Personal Finance', year: 2017, pages: 256, popularity: 66, description: 'Garder son calme et son plan quand les marchés chutent.' },
  // Indépendance & choix de vie
  { title: 'Die with Zero', author: 'Bill Perkins', genre: 'Personal Finance', year: 2020, pages: 240, popularity: 76, description: "Dépenser au bon moment de sa vie plutôt qu'accumuler sans fin." },
  { title: 'Financial Freedom', author: 'Grant Sabatier', genre: 'Personal Finance', year: 2019, pages: 400, popularity: 70, description: 'Augmenter ses revenus, épargner fort et racheter son temps.' },
  { title: 'Quit Like a Millionaire', author: 'Kristy Shen & Bryce Leung', genre: 'Personal Finance', year: 2019, pages: 320, popularity: 68, description: "Atteindre l'indépendance financière sans gros salaire de départ." },
  { title: 'Set for Life', author: 'Scott Trench', genre: 'Personal Finance', year: 2017, pages: 300, popularity: 64, description: "Un plan pour les premières années de carrière : dépenses, revenus, placements." },
];
