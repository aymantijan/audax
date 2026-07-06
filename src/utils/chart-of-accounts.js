// Plan comptable personnel — inspiré du Plan Comptable Marocain (CGNC),
// adapté à une personne physique. Même logique de classes :
//   1 Financement permanent · 2 Actif immobilisé · 3 Créances · 4 Dettes CT
//   5 Trésorerie · 6 Charges · 7 Produits
// Toute opération est saisie en partie double dans le journal ; le bilan, le CPC,
// l'ESG, l'analyse, le budget et la trésorerie en découlent automatiquement.

export const ACCOUNT_CLASSES = {
  1: { label: 'Financement permanent', side: 'passif', nature: 'credit' },
  2: { label: 'Actif immobilisé', side: 'actif', nature: 'debit' },
  3: { label: 'Créances & avances', side: 'actif', nature: 'debit' },
  4: { label: 'Dettes à court terme', side: 'passif', nature: 'credit' },
  5: { label: 'Trésorerie', side: 'actif', nature: 'debit' },
  6: { label: 'Charges', side: 'resultat', nature: 'debit' },
  7: { label: 'Produits', side: 'resultat', nature: 'credit' },
};

export const CHART_OF_ACCOUNTS = [
  // ── Classe 1 · Financement permanent ──
  { code: '111', label: 'Capital personnel', cls: 1 },
  { code: '118', label: 'Résultats cumulés (report à nouveau)', cls: 1 },
  { code: '141', label: 'Emprunt immobilier', cls: 1 },
  { code: '145', label: 'Prêt étudiant', cls: 1 },
  { code: '148', label: 'Autres emprunts long terme', cls: 1 },

  // ── Classe 2 · Actif immobilisé ──
  { code: '231', label: 'Immobilier', cls: 2 },
  { code: '234', label: 'Véhicules', cls: 2 },
  { code: '235', label: 'Matériel & équipement', cls: 2 },
  { code: '251', label: 'Titres & placements long terme', cls: 2 },
  { code: '255', label: 'Épargne retraite', cls: 2 },
  { code: '258', label: 'Objets de valeur (or, art, collections)', cls: 2 },

  // ── Classe 3 · Créances & avances ──
  { code: '341', label: 'Prêts accordés à des tiers', cls: 3 },
  { code: '345', label: 'Dépôts & cautions versés', cls: 3 },
  { code: '346', label: 'Avances & acomptes versés', cls: 3 },
  { code: '348', label: 'Autres créances', cls: 3 },

  // ── Classe 4 · Dettes à court terme ──
  { code: '441', label: 'Cartes de crédit', cls: 4 },
  { code: '445', label: 'Factures à payer', cls: 4 },
  { code: '446', label: 'Dettes envers des proches', cls: 4 },
  { code: '448', label: 'Autres dettes court terme', cls: 4 },

  // ── Classe 5 · Trésorerie ──
  { code: '511', label: 'Compte bancaire courant', cls: 5 },
  { code: '512', label: 'Compte épargne', cls: 5 },
  { code: '514', label: 'Compte trading / brokerage', cls: 5 },
  { code: '516', label: 'Portefeuille crypto', cls: 5 },
  { code: '517', label: 'Portefeuille mobile / e-wallet', cls: 5 },
  { code: '571', label: 'Espèces', cls: 5 },

  // ── Classe 6 · Charges ──
  { code: '611', label: 'Loyer & charges du logement', cls: 6, group: 'Logement' },
  { code: '612', label: 'Entretien & équipement du logement', cls: 6, group: 'Logement' },
  { code: '613', label: 'Eau, électricité, internet, téléphone', cls: 6, group: 'Logement' },
  { code: '621', label: 'Alimentation & courses', cls: 6, group: 'Vie courante' },
  { code: '622', label: 'Restaurants & cafés', cls: 6, group: 'Vie courante' },
  { code: '631', label: 'Transport & carburant', cls: 6, group: 'Transport' },
  { code: '632', label: 'Entretien véhicule', cls: 6, group: 'Transport' },
  { code: '641', label: 'Santé & médical', cls: 6, group: 'Santé' },
  { code: '642', label: 'Sport & bien-être', cls: 6, group: 'Santé' },
  { code: '651', label: 'Éducation & formation', cls: 6, group: 'Développement' },
  { code: '652', label: 'Livres & abonnements professionnels', cls: 6, group: 'Développement' },
  { code: '661', label: 'Loisirs & sorties', cls: 6, group: 'Lifestyle' },
  { code: '662', label: 'Voyages', cls: 6, group: 'Lifestyle' },
  { code: '663', label: 'Shopping & habillement', cls: 6, group: 'Lifestyle' },
  { code: '664', label: 'Abonnements & streaming', cls: 6, group: 'Lifestyle' },
  { code: '671', label: "Intérêts d'emprunts", cls: 6, group: 'Financier' },
  { code: '672', label: 'Frais bancaires', cls: 6, group: 'Financier' },
  { code: '673', label: 'Frais de trading & commissions', cls: 6, group: 'Financier' },
  { code: '681', label: 'Impôts & taxes', cls: 6, group: 'Obligations' },
  { code: '682', label: 'Assurances', cls: 6, group: 'Obligations' },
  { code: '691', label: 'Dons & cadeaux offerts', cls: 6, group: 'Autres' },
  { code: '698', label: 'Charges exceptionnelles', cls: 6, group: 'Exceptionnel', exceptional: true },

  // ── Classe 7 · Produits ──
  { code: '711', label: 'Salaire & primes', cls: 7, group: 'Travail' },
  { code: '712', label: 'Stages & indemnités', cls: 7, group: 'Travail' },
  { code: '721', label: 'Freelance & consulting', cls: 7, group: 'Indépendant' },
  { code: '731', label: 'Gains de trading', cls: 7, group: 'Placements' },
  { code: '741', label: 'Revenus locatifs', cls: 7, group: 'Placements' },
  { code: '751', label: 'Dons & cadeaux reçus', cls: 7, group: 'Autres' },
  { code: '761', label: 'Intérêts & dividendes', cls: 7, group: 'Financier' },
  { code: '771', label: "Bourses d'études", cls: 7, group: 'Autres' },
  { code: '798', label: 'Produits exceptionnels', cls: 7, group: 'Exceptionnel', exceptional: true },
];

export const ACCOUNT_MAP = Object.fromEntries(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export const accountsOfClass = (cls) => CHART_OF_ACCOUNTS.filter((a) => a.cls === cls);

export const classOf = (code) => Number(String(code)[0]);

// Nature débitrice (actif + charges) ou créditrice (passif + produits)
export const isDebitNature = (code) => ['2', '3', '5', '6'].includes(String(code)[0]);

export const accountLabel = (code) => {
  const a = ACCOUNT_MAP[code];
  return a ? `${a.code} — ${a.label}` : code;
};

// Modèles d'écritures pour rendre la partie double accessible :
// chaque modèle définit quels comptes on débite et on crédite.
export const ENTRY_TEMPLATES = [
  {
    id: 'income',
    label: 'Encaissement de revenu',
    hint: "D'où vient l'argent ? Un produit (classe 7) est crédité, la trésorerie est débitée.",
    debit: { classes: [5], default: '511', role: 'Compte qui reçoit' },
    credit: { classes: [7], default: '711', role: 'Source du revenu' },
  },
  {
    id: 'expense',
    label: 'Paiement de dépense',
    hint: "Où va l'argent ? Une charge (classe 6) est débitée, la trésorerie est créditée.",
    debit: { classes: [6], default: '621', role: 'Nature de la dépense' },
    credit: { classes: [5, 4], default: '511', role: 'Moyen de paiement' },
  },
  {
    id: 'transfer',
    label: 'Transfert entre comptes',
    hint: 'Virement interne : le compte qui reçoit est débité, celui qui envoie est crédité.',
    debit: { classes: [5], default: '512', role: 'Compte destinataire' },
    credit: { classes: [5], default: '511', role: 'Compte source' },
  },
  {
    id: 'invest',
    label: "Achat d'immobilisation / placement",
    hint: "L'actif acquis est débité (classe 2), le compte payeur est crédité.",
    debit: { classes: [2], default: '251', role: 'Actif acquis' },
    credit: { classes: [5], default: '511', role: 'Moyen de paiement' },
  },
  {
    id: 'borrow',
    label: "Réception d'un emprunt",
    hint: "La trésorerie est débitée, la dette est créditée (elle augmente).",
    debit: { classes: [5], default: '511', role: 'Compte qui reçoit' },
    credit: { classes: [1, 4], default: '148', role: 'Dette contractée' },
  },
  {
    id: 'repay',
    label: 'Remboursement de dette',
    hint: 'La dette est débitée (elle diminue), la trésorerie est créditée.',
    debit: { classes: [1, 4], default: '441', role: 'Dette remboursée' },
    credit: { classes: [5], default: '511', role: 'Moyen de paiement' },
  },
  {
    id: 'lend',
    label: 'Prêt accordé / caution versée',
    hint: 'La créance est débitée (on vous doit), la trésorerie est créditée.',
    debit: { classes: [3], default: '341', role: 'Créance créée' },
    credit: { classes: [5], default: '511', role: 'Compte source' },
  },
  {
    id: 'opening',
    label: "Soldes d'ouverture (à-nouveaux)",
    hint: 'Premier inventaire : vos avoirs sont débités, le capital personnel est crédité.',
    debit: { classes: [2, 3, 5], default: '511', role: 'Avoir inventorié' },
    credit: { classes: [1], default: '111', role: 'Contrepartie (capital)' },
  },
];

// Objectifs financiers : trésorerie (solde classe 5) ou patrimoine (ANCC).
export const GOAL_TYPES = [
  { value: 'treasury', label: 'Trésorerie (solde disponible)' },
  { value: 'networth', label: 'Net Worth (ANC Corrigé)' },
];

// Corrections de valeur : passage de l'Actif Net Comptable (ANC) à l'ANC Corrigé.
// Référencer un compte d'actif (classe 2/3/5) est optionnel — sert juste de contexte.
export const CORRECTION_TYPES = [
  { value: 'plus-value', label: 'Plus-value (valeur réelle > valeur comptable)' },
  { value: 'moins-value', label: 'Moins-value (valeur réelle < valeur comptable)' },
];

// Passerelle depuis l'ancien système (financeStore) : groupe de catégorie → compte.
export const LEGACY_CATEGORY_TO_ACCOUNT = {
  'Trading Fees': '673', 'Trading Commission': '673', 'Spread Cost': '673',
  'Data Subscriptions': '652', 'Trading Software': '652',
  'Education & Courses': '651', 'Books & Reading': '652', 'Tuition': '651', 'Mentorship Fees': '651', 'Professional Development': '651',
  'Groceries': '621', 'Food Delivery': '622', 'Coffee & Beverages': '622', 'Restaurants & Dining Out': '622',
  'Gas / Fuel': '631', 'Public Transit': '631', 'Taxi / Rideshare': '631', 'Parking': '631', 'Car Maintenance': '632',
  'Rent / Mortgage': '611', 'Utilities': '613', 'Home Maintenance': '612', 'Home Insurance': '682', 'Property Tax': '681',
  'Streaming & Subscriptions': '664', 'Gaming': '661', 'Hobbies': '661', 'Sports & Fitness': '642', 'Concerts & Events': '661',
  'Flights': '662', 'Hotels': '662', 'Car Rentals': '662', 'Activities & Tours': '662', 'Travel Insurance': '682',
  'Doctor Visits': '641', 'Prescriptions': '641', 'Gym Membership': '642', 'Personal Care': '641', 'Dental': '641', 'Vision': '641',
  'Clothing': '663', 'Shoes': '663', 'Accessories': '663', 'Furniture': '612', 'Office Supplies': '652', 'Household Goods': '612',
  'Health Insurance': '682', 'Auto Insurance': '682', 'Life Insurance': '682', 'Income Tax': '681', 'Capital Gains Tax': '681',
  'Brokerage Deposits': '251', 'Crypto Purchases': '516', 'Emergency Fund': '512',
  'Gifts': '691', 'Donations': '691', 'Pets': '661', 'Miscellaneous': '698',
};

export const LEGACY_SOURCE_TO_ACCOUNT = {
  'Salary': '711', 'Bonus': '711', 'Internship Stipend': '712',
  'Demo Trading P&L': '731', 'Real Money Trading P&L': '731',
  'Freelance / Consulting': '721', 'Investment Returns': '761',
  'Gifts / Inheritance': '751', 'Other Income': '798',
};
