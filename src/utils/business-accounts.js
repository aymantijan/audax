// Plan comptable "business" — version très simplifiée du CGNC marocain, un cran
// plus légère que le plan personnel (chart-of-accounts.js) et adaptée à une
// petite structure (auto-entreprise, SARL naissante...) plutôt qu'à un
// particulier : pas de rubriques "Logement"/"Vie courante", des rubriques
// Exploitation/Personnel/Financier à la place. Même squelette de classes
// (1 Financement · 2 Immobilisé · 3 Créances · 4 Dettes CT · 5 Trésorerie ·
// 6 Charges · 7 Produits) pour rester compatible avec accounting-engine.js
// (validateEntry, balanceSheet, cpc, financialAnalysis...) tel quel — ces
// fonctions sont pures et prennent accountMap en paramètre, donc aucune
// modification du moteur n'est nécessaire pour les réutiliser par business.

export const BUSINESS_ACCOUNT_CLASSES = {
  1: { label: 'Financement', side: 'passif', nature: 'credit' },
  2: { label: 'Immobilisations', side: 'actif', nature: 'debit' },
  3: { label: 'Créances', side: 'actif', nature: 'debit' },
  4: { label: 'Dettes court terme', side: 'passif', nature: 'credit' },
  5: { label: 'Trésorerie', side: 'actif', nature: 'debit' },
  6: { label: 'Charges', side: 'resultat', nature: 'debit' },
  7: { label: 'Produits', side: 'resultat', nature: 'credit' },
};

export const BUSINESS_CHART_OF_ACCOUNTS = [
  // ── Classe 1 · Financement ──
  { code: '111', label: 'Capital social / apports', cls: 1 },
  { code: '118', label: 'Résultats cumulés (report à nouveau)', cls: 1 },
  { code: '148', label: 'Emprunts', cls: 1 },

  // ── Classe 2 · Immobilisations ──
  { code: '221', label: 'Matériel & équipement', cls: 2 },
  { code: '222', label: 'Aménagements & installations', cls: 2 },
  { code: '223', label: 'Matériel informatique', cls: 2 },
  { code: '228', label: 'Autres immobilisations', cls: 2 },

  // ── Classe 3 · Créances ──
  { code: '342', label: 'Clients & comptes rattachés', cls: 3 },
  { code: '345', label: 'Avances & acomptes versés', cls: 3 },
  { code: '348', label: 'Autres créances', cls: 3 },

  // ── Classe 4 · Dettes court terme ──
  { code: '441', label: 'Fournisseurs & comptes rattachés', cls: 4 },
  { code: '445', label: 'État — impôts & taxes', cls: 4 },
  { code: '446', label: 'Organismes sociaux (CNSS...)', cls: 4 },
  { code: '448', label: 'Autres dettes', cls: 4 },

  // ── Classe 5 · Trésorerie ──
  { code: '511', label: 'Banque', cls: 5 },
  { code: '530', label: 'Caisse', cls: 5 },

  // ── Classe 6 · Charges ──
  { code: '611', label: 'Achats (marchandises / matières)', cls: 6, group: 'Exploitation' },
  { code: '613', label: 'Loyer & charges locatives', cls: 6, group: 'Exploitation' },
  { code: '614', label: 'Eau, électricité, internet', cls: 6, group: 'Exploitation' },
  { code: '615', label: 'Entretien & réparations', cls: 6, group: 'Exploitation' },
  { code: '622', label: 'Honoraires & prestations externes', cls: 6, group: 'Exploitation' },
  { code: '623', label: 'Marketing & publicité', cls: 6, group: 'Exploitation' },
  { code: '624', label: 'Transport & déplacements', cls: 6, group: 'Exploitation' },
  { code: '626', label: 'Frais postaux & télécom', cls: 6, group: 'Exploitation' },
  { code: '628', label: 'Frais divers de gestion', cls: 6, group: 'Exploitation' },
  { code: '631', label: 'Salaires & charges sociales', cls: 6, group: 'Personnel' },
  { code: '638', label: 'Autres charges de personnel', cls: 6, group: 'Personnel' },
  { code: '661', label: 'Frais bancaires & intérêts', cls: 6, group: 'Financier' },
  { code: '670', label: 'Impôts & taxes', cls: 6, group: 'Obligations' },
  { code: '698', label: 'Charges exceptionnelles', cls: 6, group: 'Exceptionnel', exceptional: true },

  // ── Classe 7 · Produits ──
  { code: '711', label: 'Ventes de marchandises', cls: 7, group: 'Exploitation' },
  { code: '712', label: 'Ventes de services / prestations', cls: 7, group: 'Exploitation' },
  { code: '758', label: 'Autres produits', cls: 7, group: 'Autres' },
  { code: '798', label: 'Produits exceptionnels', cls: 7, group: 'Exceptionnel', exceptional: true },
];

export const BUSINESS_ACCOUNT_MAP = Object.fromEntries(BUSINESS_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export const businessClassOf = (code) => Number(String(code)[0]);

export const businessAccountsOfClass = (cls) => BUSINESS_CHART_OF_ACCOUNTS.filter((a) => a.cls === cls);

// Modèles d'écritures — mêmes 5 mouvements que les échéances Finance
// (income/expense/invest/borrow/repay), comptes par défaut adaptés business.
export const BUSINESS_ENTRY_TEMPLATES = [
  {
    id: 'income',
    label: 'Encaissement (vente)',
    hint: "D'où vient l'argent ? Un produit (classe 7) est crédité, la trésorerie est débitée.",
    debit: { classes: [5], default: '511', role: 'Compte qui reçoit' },
    credit: { classes: [7], default: '711', role: 'Nature du produit' },
  },
  {
    id: 'expense',
    label: 'Paiement (charge)',
    hint: "Où va l'argent ? Une charge (classe 6) est débitée, la trésorerie est créditée.",
    debit: { classes: [6], default: '611', role: 'Nature de la charge' },
    credit: { classes: [5, 4], default: '511', role: 'Moyen de paiement' },
  },
  {
    id: 'invest',
    label: "Achat d'immobilisation",
    hint: "L'actif acquis est débité, le compte payeur est crédité.",
    debit: { classes: [2], default: '221', role: 'Actif acquis' },
    credit: { classes: [5], default: '511', role: 'Moyen de paiement' },
  },
  {
    id: 'borrow',
    label: 'Apport / emprunt reçu',
    hint: 'La trésorerie est débitée, le financement est crédité.',
    debit: { classes: [5], default: '511', role: 'Compte qui reçoit' },
    credit: { classes: [1], default: '148', role: 'Financement' },
  },
  {
    id: 'repay',
    label: 'Remboursement',
    hint: 'La dette est débitée (elle diminue), la trésorerie est créditée.',
    debit: { classes: [1, 4], default: '148', role: 'Dette remboursée' },
    credit: { classes: [5], default: '511', role: 'Moyen de paiement' },
  },
];
