// Moteur comptable — fonctions pures sur le journal (partie double).
// Le journal est LA source de vérité ; tout le reste (grand livre, balance,
// bilan, CPC, ESG, analyse FR/BFR/TN, budget, trésorerie) en est dérivé.
//
// Écriture : { id, date: 'YYYY-MM-DD', ref, label, lines: [{ account, debit, credit }] }

import { ACCOUNT_MAP, classOf, isDebitNature } from './chart-of-accounts';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────────── Validation ───────────────────────────

// Une écriture est valide si : date + libellé, ≥ 2 lignes, comptes connus,
// chaque ligne a débit XOR crédit > 0, et Σ débits = Σ crédits (partie double).
export function validateEntry(entry) {
  if (!entry.date) return { ok: false, error: 'La date est requise.' };
  if (!entry.label?.trim()) return { ok: false, error: 'Le libellé est requis.' };
  const lines = (entry.lines || []).filter((l) => Number(l.debit) || Number(l.credit));
  if (lines.length < 2) return { ok: false, error: 'Une écriture exige au moins deux lignes (partie double).' };
  for (const l of lines) {
    if (!ACCOUNT_MAP[l.account]) return { ok: false, error: `Compte inconnu : ${l.account}` };
    const d = Number(l.debit) || 0;
    const c = Number(l.credit) || 0;
    if (d < 0 || c < 0) return { ok: false, error: 'Les montants doivent être positifs.' };
    if (d > 0 && c > 0) return { ok: false, error: 'Une ligne est débit OU crédit, jamais les deux.' };
    if (d === 0 && c === 0) return { ok: false, error: 'Chaque ligne doit porter un montant.' };
  }
  const totalD = r2(lines.reduce((a, l) => a + (Number(l.debit) || 0), 0));
  const totalC = r2(lines.reduce((a, l) => a + (Number(l.credit) || 0), 0));
  if (Math.abs(totalD - totalC) > 0.009) {
    return { ok: false, error: `Écriture déséquilibrée : débits ${totalD} ≠ crédits ${totalC}.` };
  }
  return { ok: true, lines, total: totalD };
}

// ─────────────────────────── Filtres période ───────────────────────────

const inPeriod = (date, { from, to } = {}) => (!from || date >= from) && (!to || date <= to);

export const monthKey = (date) => String(date).slice(0, 7); // 'YYYY-MM'

// ─────────────────────────── Grand livre & balance ───────────────────────────

// Soldes par compte : { code: { debit, credit, balance } }.
// balance = débits − crédits (positif = solde débiteur).
export function accountBalances(journal, period) {
  const map = {};
  for (const e of journal) {
    if (!inPeriod(e.date, period)) continue;
    for (const l of e.lines) {
      const acc = (map[l.account] ??= { debit: 0, credit: 0 });
      acc.debit += Number(l.debit) || 0;
      acc.credit += Number(l.credit) || 0;
    }
  }
  for (const acc of Object.values(map)) {
    acc.debit = r2(acc.debit);
    acc.credit = r2(acc.credit);
    acc.balance = r2(acc.debit - acc.credit);
  }
  return map;
}

// Mouvements d'un compte, en ordre chronologique, avec solde progressif.
export function ledgerFor(journal, code, period) {
  const rows = [];
  const sorted = [...journal].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  let running = 0;
  for (const e of sorted) {
    if (!inPeriod(e.date, period)) continue;
    for (const l of e.lines) {
      if (l.account !== code) continue;
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      running = r2(running + d - c);
      rows.push({ entryId: e.id, date: e.date, label: e.label, ref: e.ref, debit: d, credit: c, running });
    }
  }
  return rows;
}

// Balance générale : une ligne par compte mouvementé + totaux (débits = crédits).
export function trialBalance(journal, period) {
  const balances = accountBalances(journal, period);
  const rows = Object.entries(balances)
    .map(([code, b]) => ({
      code,
      label: ACCOUNT_MAP[code]?.label || code,
      cls: classOf(code),
      debit: b.debit,
      credit: b.credit,
      soldeDebiteur: b.balance > 0 ? b.balance : 0,
      soldeCrediteur: b.balance < 0 ? -b.balance : 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const totals = rows.reduce(
    (t, r) => ({
      debit: r2(t.debit + r.debit),
      credit: r2(t.credit + r.credit),
      soldeDebiteur: r2(t.soldeDebiteur + r.soldeDebiteur),
      soldeCrediteur: r2(t.soldeCrediteur + r.soldeCrediteur),
    }),
    { debit: 0, credit: 0, soldeDebiteur: 0, soldeCrediteur: 0 }
  );
  return { rows, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 };
}

// ─────────────────────────── États de synthèse ───────────────────────────

const sumClass = (balances, cls, sign = 1) =>
  r2(Object.entries(balances).filter(([c]) => classOf(c) === cls).reduce((a, [, b]) => a + sign * b.balance, 0));

const detailClass = (balances, cls, sign = 1) =>
  Object.entries(balances)
    .filter(([c]) => classOf(c) === cls)
    .map(([code, b]) => ({ code, label: ACCOUNT_MAP[code]?.label || code, group: ACCOUNT_MAP[code]?.group, amount: r2(sign * b.balance) }))
    .filter((x) => x.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

// BILAN à une date : Actif (2+3+5) = Passif (1+4) + Résultat cumulé (7−6).
export function balanceSheet(journal, until) {
  const balances = accountBalances(journal, until ? { to: until } : undefined);
  const immobilise = sumClass(balances, 2);
  const creances = sumClass(balances, 3);
  const tresorerie = sumClass(balances, 5);
  const capitaux = sumClass(balances, 1, -1); // nature créditrice → on inverse le signe
  const dettesCT = sumClass(balances, 4, -1);
  const produits = sumClass(balances, 7, -1);
  const charges = sumClass(balances, 6);
  const resultat = r2(produits - charges); // bénéfice = ressource au passif

  const totalActif = r2(immobilise + creances + tresorerie);
  const totalPassif = r2(capitaux + dettesCT + resultat);
  return {
    actif: {
      immobilise, creances, tresorerie, total: totalActif,
      detailImmobilise: detailClass(balances, 2),
      detailCreances: detailClass(balances, 3),
      detailTresorerie: detailClass(balances, 5),
    },
    passif: {
      capitaux, dettesCT, resultat, total: totalPassif,
      detailCapitaux: detailClass(balances, 1, -1),
      detailDettesCT: detailClass(balances, 4, -1),
    },
    equilibre: Math.abs(totalActif - totalPassif) < 0.01,
  };
}

// CPC sur une période : produits/charges courants et exceptionnels → résultat net.
export function cpc(journal, period) {
  const balances = accountBalances(journal, period);
  const detailProduits = detailClass(balances, 7, -1);
  const detailCharges = detailClass(balances, 6);
  const isExcep = (code) => !!ACCOUNT_MAP[code]?.exceptional;
  const sum = (rows, pred) => r2(rows.filter(pred).reduce((a, x) => a + x.amount, 0));

  const produitsCourants = sum(detailProduits, (x) => !isExcep(x.code));
  const chargesCourantes = sum(detailCharges, (x) => !isExcep(x.code));
  const produitsExcep = sum(detailProduits, (x) => isExcep(x.code));
  const chargesExcep = sum(detailCharges, (x) => isExcep(x.code));

  const resultatCourant = r2(produitsCourants - chargesCourantes);
  const resultatExcep = r2(produitsExcep - chargesExcep);
  const resultatNet = r2(resultatCourant + resultatExcep);

  return { detailProduits, detailCharges, produitsCourants, chargesCourantes, produitsExcep, chargesExcep, resultatCourant, resultatExcep, resultatNet };
}

// ESG — cascade des soldes de gestion, adaptée à une personne physique :
//   Revenus d'activité
//   − Dépenses de vie courante (61→66)            = Épargne brute (équiv. EBE)
//   − Obligations (68 impôts & assurances)        = Épargne après obligations
//   + Produits financiers (76) − Charges fin. (67) = Résultat courant
//   ± Éléments exceptionnels (798 − 698)           = Résultat net
//   Taux d'épargne = Résultat net / Revenus totaux
export function esg(journal, period) {
  const balances = accountBalances(journal, period);
  const amount = (code, sign = 1) => r2(sign * (balances[code]?.balance || 0));
  const sumCodes = (pred, sign = 1) =>
    r2(Object.entries(balances).filter(([c]) => pred(c)).reduce((a, [, b]) => a + sign * b.balance, 0));

  const startsWithAny = (code, prefixes) => prefixes.some((p) => code.startsWith(p));

  const revenusActivite = sumCodes((c) => classOf(c) === 7 && !ACCOUNT_MAP[c]?.exceptional && !c.startsWith('76'), -1);
  const vieCourante = sumCodes((c) => classOf(c) === 6 && startsWithAny(c, ['61', '62', '63', '64', '65', '66', '69']) && !ACCOUNT_MAP[c]?.exceptional);
  const epargneBrute = r2(revenusActivite - vieCourante);

  const obligations = sumCodes((c) => c.startsWith('68'));
  const epargneApresObligations = r2(epargneBrute - obligations);

  const produitsFinanciers = sumCodes((c) => c.startsWith('76'), -1);
  const chargesFinancieres = sumCodes((c) => c.startsWith('67'));
  const resultatFinancier = r2(produitsFinanciers - chargesFinancieres);
  const resultatCourant = r2(epargneApresObligations + resultatFinancier);

  const exceptionnel = r2(amount('798', -1) - amount('698'));
  const resultatNet = r2(resultatCourant + exceptionnel);

  const revenusTotaux = r2(revenusActivite + produitsFinanciers + amount('798', -1));
  const tauxEpargne = revenusTotaux > 0 ? r2((resultatNet / revenusTotaux) * 100) : null;

  return {
    revenusActivite, vieCourante, epargneBrute,
    obligations, epargneApresObligations,
    produitsFinanciers, chargesFinancieres, resultatFinancier, resultatCourant,
    exceptionnel, resultatNet, revenusTotaux, tauxEpargne,
  };
}

// ─────────────────────────── Analyse financière ───────────────────────────

// Équilibre financier (approche bilancielle) :
//   FR  = Financement permanent (1 + résultat) − Actif immobilisé (2)
//   BFR = Créances (3) − Dettes CT (4)
//   TN  = FR − BFR  (doit égaler la trésorerie de classe 5)
export function financialAnalysis(journal, until) {
  const bs = balanceSheet(journal, until);
  const financementPermanent = r2(bs.passif.capitaux + bs.passif.resultat);
  const fondsRoulement = r2(financementPermanent - bs.actif.immobilise);
  const bfr = r2(bs.actif.creances - bs.passif.dettesCT);
  const tresorerieNette = r2(fondsRoulement - bfr);

  const totalPassif = bs.passif.total || 0;
  const dettes = r2(bs.passif.dettesCT + Math.max(0, -bs.passif.capitaux)); // capitaux négatifs = surendettement
  const dettesTotales = r2(
    bs.passif.dettesCT +
      bs.passif.detailCapitaux.filter((x) => x.code !== '111' && x.code !== '118').reduce((a, x) => a + x.amount, 0)
  );
  const capitauxPropres = r2(bs.passif.capitaux + bs.passif.resultat - (dettesTotales - bs.passif.dettesCT));

  const ratios = {
    autonomieFinanciere: totalPassif !== 0 ? r2((capitauxPropres / totalPassif) * 100) : null,
    endettement: totalPassif !== 0 ? r2((dettesTotales / totalPassif) * 100) : null,
    liquiditeGenerale: bs.passif.dettesCT > 0 ? r2((bs.actif.creances + bs.actif.tresorerie) / bs.passif.dettesCT) : null,
    liquiditeImmediate: bs.passif.dettesCT > 0 ? r2(bs.actif.tresorerie / bs.passif.dettesCT) : null,
    couvertureImmobilisations: bs.actif.immobilise > 0 ? r2((financementPermanent / bs.actif.immobilise) * 100) : null,
  };

  return { bs, financementPermanent, fondsRoulement, bfr, tresorerieNette, dettesTotales, capitauxPropres, ratios };
}

// ─────────────────────────── Séries historiques ───────────────────────────

// Série mensuelle : produits, charges, résultat, flux de trésorerie et solde cumulé.
export function monthlySeries(journal, months = 6) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth = Object.fromEntries(keys.map((k) => [k, { produits: 0, charges: 0, encaissements: 0, decaissements: 0 }]));

  let soldeAvant = 0; // trésorerie accumulée avant la fenêtre affichée
  for (const e of journal) {
    const mk = monthKey(e.date);
    for (const l of e.lines) {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      const cls = classOf(l.account);
      if (byMonth[mk]) {
        if (cls === 7) byMonth[mk].produits += c - d;
        if (cls === 6) byMonth[mk].charges += d - c;
        if (cls === 5) {
          if (d > 0) byMonth[mk].encaissements += d;
          if (c > 0) byMonth[mk].decaissements += c;
        }
      } else if (mk < keys[0] && cls === 5) {
        soldeAvant += d - c;
      }
    }
  }

  let solde = r2(soldeAvant);
  return keys.map((k) => {
    const m = byMonth[k];
    const flux = r2(m.encaissements - m.decaissements);
    solde = r2(solde + flux);
    const [y, mo] = k.split('-');
    return {
      key: k,
      label: new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      produits: r2(m.produits),
      charges: r2(m.charges),
      resultat: r2(m.produits - m.charges),
      encaissements: r2(m.encaissements),
      decaissements: r2(m.decaissements),
      flux,
      solde,
    };
  });
}

// ─────────────────────────── Gestion budgétaire ───────────────────────────

// Écarts budget/réel pour un mois donné. budgets: [{ account, amount }] (mensuel).
// Convention gestion budgétaire : écart = réel − budget ;
//   compte de charges  → écart > 0 défavorable ;
//   compte de produits → écart > 0 favorable.
export function budgetVariance(journal, budgets, mk) {
  const period = { from: `${mk}-01`, to: `${mk}-31` };
  const balances = accountBalances(journal, period);
  return budgets.map((b) => {
    const cls = classOf(b.account);
    const bal = balances[b.account];
    const reel = r2(cls === 7 ? -(bal?.balance || 0) : bal?.balance || 0);
    const ecart = r2(reel - b.amount);
    const favorable = cls === 7 ? ecart >= 0 : ecart <= 0;
    const realisation = b.amount > 0 ? r2((reel / b.amount) * 100) : null;
    return { ...b, cls, label: ACCOUNT_MAP[b.account]?.label || b.account, reel, ecart, favorable, realisation };
  });
}

// Budget de trésorerie prévisionnel : à partir du solde actuel (classe 5) et
// du solde budgété mensuel (Σ budgets produits − Σ budgets charges).
export function treasuryForecast(journal, budgets, monthsAhead = 6) {
  const balances = accountBalances(journal);
  const soldeActuel = sumClass(balances, 5);
  const budgetNet = r2(
    budgets.reduce((a, b) => a + (classOf(b.account) === 7 ? b.amount : -b.amount), 0)
  );
  const out = [];
  let solde = soldeActuel;
  const now = new Date();
  for (let i = 1; i <= monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    solde = r2(solde + budgetNet);
    out.push({ label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), solde });
  }
  return { soldeActuel, budgetNet, series: out };
}
