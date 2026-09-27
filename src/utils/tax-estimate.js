// Tax ESTIMATE (étape 5, Morocco first). Indicative only — shown as such in
// the UI, with the scale used, never as tax advice. Pure: tests/tax-estimate.test.mjs.
//
// Morocco, impôt sur le revenu — annual scale from the 2025 finance law
// (loi de finances 2025): tax = income × rate − deduction for the bracket.
export const MA_IR_2025 = [
  { upTo: 40000, rate: 0, deduction: 0 },
  { upTo: 60000, rate: 0.10, deduction: 4000 },
  { upTo: 80000, rate: 0.20, deduction: 10000 },
  { upTo: 100000, rate: 0.30, deduction: 18000 },
  { upTo: 180000, rate: 0.34, deduction: 22000 },
  { upTo: Infinity, rate: 0.37, deduction: 27400 },
];

// Auto-entrepreneur: a flat share of turnover, within a yearly ceiling.
export const MA_AUTO_ENTREPRENEUR = {
  commerce: { label: 'Commerce, industrie, artisanat', rate: 0.005, ceiling: 500000 },
  services: { label: 'Prestations de services', rate: 0.01, ceiling: 200000 },
};

const r0 = (n) => Math.round(n);

/** Annual income tax on a net taxable income, with the bracket reached. */
export function moroccoIncomeTax(netTaxable) {
  const income = Math.max(0, Number(netTaxable) || 0);
  const bracket = MA_IR_2025.find((b) => income <= b.upTo);
  const tax = Math.max(0, income * bracket.rate - bracket.deduction);
  return {
    tax: r0(tax),
    monthly: r0(tax / 12),
    marginalRate: bracket.rate,
    effectiveRate: income ? tax / income : 0,
  };
}

/** Auto-entrepreneur tax on turnover; flags when the ceiling is passed. */
export function moroccoAutoEntrepreneur(turnover, activity = 'services') {
  const ca = Math.max(0, Number(turnover) || 0);
  const a = MA_AUTO_ENTREPRENEUR[activity] || MA_AUTO_ENTREPRENEUR.services;
  return { tax: r0(ca * a.rate), rate: a.rate, ceiling: a.ceiling, overCeiling: ca > a.ceiling };
}

export const TAX_COUNTRIES = ['MA'];
