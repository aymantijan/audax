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
export function validateEntry(entry, accountMap = ACCOUNT_MAP) {
  if (!entry.date) return { ok: false, error: 'La date est requise.' };
  if (!entry.label?.trim()) return { ok: false, error: 'Le libellé est requis.' };
  const lines = (entry.lines || []).filter((l) => Number(l.debit) || Number(l.credit));
  if (lines.length < 2) return { ok: false, error: 'Une écriture exige au moins deux lignes (partie double).' };
  for (const l of lines) {
    if (!accountMap[l.account]) return { ok: false, error: `Compte inconnu : ${l.account}` };
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
export function trialBalance(journal, period, accountMap = ACCOUNT_MAP) {
  const balances = accountBalances(journal, period);
  const rows = Object.entries(balances)
    .map(([code, b]) => ({
      code,
      label: accountMap[code]?.label || code,
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

const detailClass = (balances, cls, sign = 1, accountMap = ACCOUNT_MAP) =>
  Object.entries(balances)
    .filter(([c]) => classOf(c) === cls)
    .map(([code, b]) => ({ code, label: accountMap[code]?.label || code, group: accountMap[code]?.group, amount: r2(sign * b.balance) }))
    .filter((x) => x.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

// BILAN à une date : Actif (2+3+5) = Passif (1+4) + Résultat cumulé (7−6).
export function balanceSheet(journal, until, accountMap = ACCOUNT_MAP) {
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
      detailImmobilise: detailClass(balances, 2, 1, accountMap),
      detailCreances: detailClass(balances, 3, 1, accountMap),
      detailTresorerie: detailClass(balances, 5, 1, accountMap),
    },
    passif: {
      capitaux, dettesCT, resultat, total: totalPassif,
      detailCapitaux: detailClass(balances, 1, -1, accountMap),
      detailDettesCT: detailClass(balances, 4, -1, accountMap),
    },
    equilibre: Math.abs(totalActif - totalPassif) < 0.01,
  };
}

// CPC sur une période : produits/charges courants et exceptionnels → résultat net.
export function cpc(journal, period, accountMap = ACCOUNT_MAP) {
  const balances = accountBalances(journal, period);
  const detailProduits = detailClass(balances, 7, -1, accountMap);
  const detailCharges = detailClass(balances, 6, 1, accountMap);
  const isExcep = (code) => !!accountMap[code]?.exceptional;
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
//
// Actif Net Comptable (ANC) — la valeur patrimoniale automatique demandée :
//   ANC = Total Actif − Total des dettes (emprunts long terme + dettes court terme)
// Les comptes 111 (capital personnel) et 118 (report à nouveau) ne sont PAS des
// dettes envers un tiers, donc exclus de "Total des dettes". Par construction de
// la partie double, ANC = Capital + Report à nouveau + Résultat cumulé — l'égalité
// est vérifiée automatiquement à chaque écriture, sans aucune saisie manuelle.
export function financialAnalysis(journal, until, accountMap = ACCOUNT_MAP) {
  const bs = balanceSheet(journal, until, accountMap);
  const financementPermanent = r2(bs.passif.capitaux + bs.passif.resultat);
  const fondsRoulement = r2(financementPermanent - bs.actif.immobilise);
  const bfr = r2(bs.actif.creances - bs.passif.dettesCT);
  const tresorerieNette = r2(fondsRoulement - bfr);

  const totalPassif = bs.passif.total || 0;
  const empruntsLT = r2(bs.passif.detailCapitaux.filter((x) => x.code !== '111' && x.code !== '118').reduce((a, x) => a + x.amount, 0));
  const dettesTotales = r2(bs.passif.dettesCT + empruntsLT);
  const anc = r2(bs.actif.total - dettesTotales);

  const ratios = {
    autonomieFinanciere: totalPassif !== 0 ? r2((anc / totalPassif) * 100) : null,
    endettement: totalPassif !== 0 ? r2((dettesTotales / totalPassif) * 100) : null,
    liquiditeGenerale: bs.passif.dettesCT > 0 ? r2((bs.actif.creances + bs.actif.tresorerie) / bs.passif.dettesCT) : null,
    liquiditeImmediate: bs.passif.dettesCT > 0 ? r2(bs.actif.tresorerie / bs.passif.dettesCT) : null,
    couvertureImmobilisations: bs.actif.immobilise > 0 ? r2((financementPermanent / bs.actif.immobilise) * 100) : null,
  };

  return { bs, financementPermanent, fondsRoulement, bfr, tresorerieNette, dettesTotales, empruntsLT, anc, ratios };
}

// Actif Net Comptable Corrigé (ANCC) — méthode patrimoniale :
//   ANCC = ANC + Plus-values sur éléments d'actif − Moins-values sur éléments d'actif
// Les plus/moins-values sont saisies manuellement : écart entre la valeur comptable
// (coût historique) et la valeur réelle actuelle d'un bien (immobilier réévalué,
// véhicule décoté, participation non cotée, cours du marché d'un actif crypto...).
export function correctedNetWorth(anc, corrections = [], until) {
  const active = until ? corrections.filter((c) => !c.date || c.date <= until) : corrections;
  const plusValues = r2(active.filter((c) => c.type === 'plus-value').reduce((a, c) => a + (Number(c.amount) || 0), 0));
  const moinsValues = r2(active.filter((c) => c.type === 'moins-value').reduce((a, c) => a + (Number(c.amount) || 0), 0));
  return { plusValues, moinsValues, ancc: r2(anc + plusValues - moinsValues) };
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
export function budgetVariance(journal, budgets, mk, accountMap = ACCOUNT_MAP) {
  const period = { from: `${mk}-01`, to: `${mk}-31` };
  const balances = accountBalances(journal, period);
  return budgets.map((b) => {
    const cls = classOf(b.account);
    const bal = balances[b.account];
    const reel = r2(cls === 7 ? -(bal?.balance || 0) : bal?.balance || 0);
    const ecart = r2(reel - b.amount);
    const favorable = cls === 7 ? ecart >= 0 : ecart <= 0;
    const realisation = b.amount > 0 ? r2((reel / b.amount) * 100) : null;
    return { ...b, cls, label: accountMap[b.account]?.label || b.account, reel, ecart, favorable, realisation };
  });
}

// Solde de trésorerie (classe 5) à une date donnée — brique de base des objectifs de trésorerie.
export function treasuryBalance(journal, until) {
  return sumClass(accountBalances(journal, until ? { to: until } : undefined), 5);
}

// Historique mensuel de l'ANC / ANCC (fin de mois) — sert à tracer la progression
// du patrimoine ET à calculer un rythme mensuel pour projeter les objectifs.
export function netWorthHistory(journal, corrections, months = 12) {
  return monthlySeries(journal, months).map((m) => {
    const until = `${m.key}-31`;
    const fa = financialAnalysis(journal, until);
    const cv = correctedNetWorth(fa.anc, corrections, until);
    return { key: m.key, label: m.label, anc: fa.anc, ancc: cv.ancc };
  });
}

// Rythme moyen entre le premier et le dernier point d'une série (valeur/mois).
export function paceFromEdges(points, key) {
  if (!points || points.length < 2) return 0;
  const first = points[0][key];
  const last = points[points.length - 1][key];
  return r2((last - first) / (points.length - 1));
}

// Projection linéaire d'une valeur à une date cible, à partir d'un rythme mensuel.
export function projectValue(current, monthlyPace, targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const monthsLeft = Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
  return r2(current + monthlyPace * monthsLeft);
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

// ─── Échéances & prévision de trésorerie v2 (jour par jour) ───
// Échéance : { id, label, type:'produit'|'charge', natureAccount (classe 6/7),
//   treasuryAccount (classe 5/4), amount, dueDate, recurrence:'once'|'monthly'|
//   'quarterly'|'yearly', endDate, active, paidDates:[] }

// Étale une échéance récurrente en occurrences concrètes dans [fromDate, toDate]
// (bornes incluses, chaînes 'YYYY-MM-DD'), en excluant les occurrences déjà
// réglées (paidDates). Approximation calendaire simple : avance de N mois via
// Date(y, m+N, d) — une échéance fixée au 31 peut glisser sur un mois plus
// court (Date le normalise), acceptable pour une prévision, pas un relevé.
export function echeanceOccurrences(ech, fromDate, toDate) {
  if (!ech.active) return [];
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  const end = ech.endDate ? new Date(ech.endDate + 'T00:00:00') : null;
  const paid = new Set(ech.paidDates || []);
  const out = [];
  if (ech.recurrence === 'once') {
    const d = new Date(ech.dueDate + 'T00:00:00');
    if (d >= from && d <= to && !paid.has(ech.dueDate)) out.push(ech.dueDate);
    return out;
  }
  const stepMonths = { monthly: 1, quarterly: 3, yearly: 12 }[ech.recurrence] || 1;
  let d = new Date(ech.dueDate + 'T00:00:00');
  let guard = 0; // filet de sécurité anti-boucle-infinie, jamais censé être atteint
  while (d <= to && guard < 600) {
    guard++;
    if (end && d > end) break;
    const key = d.toISOString().slice(0, 10);
    if (d >= from && !paid.has(key)) out.push(key);
    d = new Date(d.getFullYear(), d.getMonth() + stepMonths, d.getDate());
  }
  return out;
}

// Rythme mensuel moyen réel par compte (classes 6 & 7), sur les `months`
// derniers mois du journal — la détection "d'habitudes" qui remplace le
// lissage purement budgétaire. Signe unifié : credit − debit sur la ligne
// classe 6/7 = impact trésorerie de sa contrepartie classe 5 (un produit
// crédité = encaissement futur ; une charge débitée = décaissement futur).
function monthlyAverageByAccount(journal, months = 3) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const byAccount = {};
  for (const e of journal) {
    if (e.date < cutoffKey) continue;
    for (const l of e.lines) {
      const cls = classOf(l.account);
      if (cls !== 6 && cls !== 7) continue;
      byAccount[l.account] = (byAccount[l.account] || 0) + (l.credit - l.debit);
    }
  }
  return Object.fromEntries(Object.entries(byAccount).map(([k, v]) => [k, v / months]));
}

// Prévision de trésorerie v2, jour par jour sur `days` jours : solde actuel +
// habitudes réelles détectées sur les comptes SANS échéance active qui les
// couvre (pour ne pas compter deux fois le même flux) + échéances (montants
// et dates exacts) + estimation optionnelle de payout trading. Les habitudes
// et le payout sont lissés en quote-part quotidienne (simplification assumée :
// on ne prétend pas connaître le jour exact d'un flux non-échéancé).
export function treasuryForecastV2(journal, echeances, { days = 90, tradingMonthlyPayout = 0 } = {}) {
  const soldeActuel = treasuryBalance(journal);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  const endKey = endDate.toISOString().slice(0, 10);

  const activeEch = (echeances || []).filter((e) => e.active);
  const coveredAccounts = new Set(activeEch.map((e) => e.natureAccount));
  const habitAvg = monthlyAverageByAccount(journal, 3);
  const freeHabitMonthly = r2(
    Object.entries(habitAvg).filter(([acct]) => !coveredAccounts.has(acct)).reduce((a, [, v]) => a + v, 0)
  );
  const dailyBaseline = (freeHabitMonthly + tradingMonthlyPayout) / 30;

  const echByDate = {};
  for (const ech of activeEch) {
    for (const occDate of echeanceOccurrences(ech, todayKey, endKey)) {
      const signed = ech.type === 'produit' ? Number(ech.amount) : -Number(ech.amount);
      echByDate[occDate] = r2((echByDate[occDate] || 0) + signed);
    }
  }

  const series = [];
  const alerts = [];
  let solde = soldeActuel;
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    solde = r2(solde + dailyBaseline + (echByDate[key] || 0));
    if (solde < 0 && (!series.length || series[series.length - 1].solde >= 0)) alerts.push({ date: key, solde });
    series.push({ date: key, label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), solde, echeance: echByDate[key] || 0 });
  }
  return { soldeActuel, freeHabitMonthly, series, alerts, echeancesInWindow: Object.keys(echByDate).length };
}

// Prévision de patrimoine (ANCC) jour par jour : réutilise la trajectoire de
// trésorerie de treasuryForecastV2 (habitudes + échéances + payout trading en
// option) et la recombine avec le reste du bilan (immobilisations, créances,
// dettes, emprunts, corrections manuelles) — simplification assumée : ces
// autres postes sont gelés à leur valeur actuelle sur tout l'horizon, car les
// échéances ne modélisent aujourd'hui que les flux classe 5 ↔ 6/7, pas les
// mouvements d'immobilisations/emprunts (achat, remboursement de principal...).
// Documenté dans l'UI plutôt que caché.
export function netWorthForecastV2(journal, corrections, echeances, { days = 90, tradingMonthlyPayout = 0 } = {}) {
  const treso = treasuryForecastV2(journal, echeances, { days, tradingMonthlyPayout });
  const analysis = financialAnalysis(journal);
  // ANC hors trésorerie (immobilisé + créances − dettes totales), gelé sur l'horizon.
  const fixedBase = r2(analysis.anc - treso.soldeActuel);
  const anccActuel = correctedNetWorth(analysis.anc, corrections).ancc;
  const series = treso.series.map((pt) => ({ date: pt.date, label: pt.label, ancc: correctedNetWorth(r2(fixedBase + pt.solde), corrections).ancc }));
  const alerts = treso.alerts.map((a) => ({ date: a.date, ancc: correctedNetWorth(r2(fixedBase + a.solde), corrections).ancc }));
  return { anccActuel, fixedBase, series, alerts };
}
