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

// Résultat (produits − charges) JOUR PAR JOUR sur [from, to] — brique du
// calendrier P&L Finance : contrairement à monthlySeries (agrégé au mois),
// chaque jour ayant au moins un mouvement de résultat (classe 6 ou 7) obtient
// sa propre entrée. Clé de retour = date 'YYYY-MM-DD'. Un jour sans mouvement
// n'apparaît pas dans la map (comme dailyMap côté PnLCalendar trading).
export function dailyResults(journal, from, to) {
  const map = {};
  for (const e of journal) {
    if (!inPeriod(e.date, { from, to })) continue;
    for (const l of e.lines) {
      const cls = classOf(l.account);
      if (cls !== 6 && cls !== 7) continue;
      const row = (map[e.date] ??= { produits: 0, charges: 0 });
      if (cls === 7) row.produits += (Number(l.credit) || 0) - (Number(l.debit) || 0);
      else row.charges += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    }
  }
  return Object.fromEntries(
    Object.entries(map).map(([d, v]) => [d, { produits: r2(v.produits), charges: r2(v.charges), resultat: r2(v.produits - v.charges) }])
  );
}

// ─────────────────────────── Gestion budgétaire ───────────────────────────

// Un budget peut être défini sur 3 familles de période :
//  - 'calendar' : n mois calendaires (1=mensuel, 3=trimestriel, 6=semestriel,
//    12=annuel, ou tout n personnalisé) ancrés sur les cycles calendaires
//    standards — pas glissant : un trimestre est toujours Jan-Mar / Avr-Juin /
//    Juil-Sep / Oct-Déc, jamais "les 3 derniers mois depuis aujourd'hui".
//  - 'weekly' : semaine civile, toujours lundi → dimanche.
//  - 'custom' : dates de début/fin choisies par l'utilisateur. `recurring`
//    fait boucler la même durée en continu (ex: du 15 au 14 du mois suivant,
//    indéfiniment) ; sinon période unique et fixe, toujours la même quelle
//    que soit la date de référence.
// Un budget sans `.period` (créé avant cette généralisation) est traité comme
// mensuel — rétro-compatible sans migration de données, même principe que
// resolveEcheanceLines pour les échéances.
export const DEFAULT_BUDGET_PERIOD = { type: 'calendar', months: 1 };

const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// Bornes { from, to } (inclusives, 'YYYY-MM-DD') de la période EN COURS à
// `refDate` pour une config de période donnée.
export function getPeriodBounds(period, refDate) {
  const p = period || DEFAULT_BUDGET_PERIOD;
  const ref = new Date(`${refDate || new Date().toISOString().slice(0, 10)}T00:00:00`);

  if (p.type === 'weekly') {
    const day = ref.getDay(); // 0=dim..6=sam
    const monday = addDays(ref, day === 0 ? -6 : 1 - day);
    return { from: dateKey(monday), to: dateKey(addDays(monday, 6)) };
  }

  if (p.type === 'custom') {
    if (!p.startDate || !p.endDate) return { from: refDate, to: refDate };
    if (!p.recurring) return { from: p.startDate, to: p.endDate };
    const start = new Date(`${p.startDate}T00:00:00`);
    const end = new Date(`${p.endDate}T00:00:00`);
    const lengthDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    if (ref < start) return { from: p.startDate, to: p.endDate };
    const cycleIndex = Math.floor((ref - start) / 86400000 / lengthDays);
    const cycleStart = addDays(start, cycleIndex * lengthDays);
    return { from: dateKey(cycleStart), to: dateKey(addDays(cycleStart, lengthDays - 1)) };
  }

  // 'calendar' (défaut) : n mois ancrés sur les cycles calendaires standards
  // (ex: n=3 → trimestres civils, indépendamment du jour où on regarde).
  const months = Math.max(1, Number(p.months) || 1);
  const monthsSinceEpoch = ref.getFullYear() * 12 + ref.getMonth();
  const cycleStartMonths = Math.floor(monthsSinceEpoch / months) * months;
  const y = Math.floor(cycleStartMonths / 12);
  const m = cycleStartMonths % 12;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + months, 0); // dernier jour du cycle
  return { from: dateKey(start), to: dateKey(end) };
}

// Libellé humain de la période (pour l'UI) à partir de ses bornes déjà calculées.
export function periodLabel(period, bounds) {
  const p = period || DEFAULT_BUDGET_PERIOD;
  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (p.type === 'weekly') return `Semaine du ${fmt(bounds.from)} au ${fmt(bounds.to)}`;
  if (p.type === 'custom') return `${fmt(bounds.from)} → ${fmt(bounds.to)}${p.recurring ? ' (récurrent)' : ''}`;
  const months = Math.max(1, Number(p.months) || 1);
  if (months === 1) return new Date(`${bounds.from}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  if (months === 12) return `Année ${new Date(`${bounds.from}T00:00:00`).getFullYear()}`;
  return `${fmt(bounds.from)} → ${fmt(bounds.to)}`;
}

// Équivalent mensuel d'un budget, quelle que soit sa période — sert à
// normaliser les budgets non-mensuels partout où le moteur raisonne en
// rythme mensuel (treasuryForecast, méthode 'budget' de treasuryForecastV2).
// Un custom non-récurrent est un événement ponctuel, pas un rythme qui se
// répète chaque mois : il contribue 0 ici (il reste visible tel quel dans
// budgetVariance, seule sa projection mensuelle est neutre).
export function budgetMonthlyEquivalent(budget) {
  const p = budget.period || DEFAULT_BUDGET_PERIOD;
  const amount = Number(budget.amount) || 0;
  const DAYS_PER_MONTH = 365.25 / 12;
  if (p.type === 'weekly') return r2((amount / 7) * DAYS_PER_MONTH);
  if (p.type === 'custom') {
    if (!p.recurring || !p.startDate || !p.endDate) return 0;
    const start = new Date(`${p.startDate}T00:00:00`);
    const end = new Date(`${p.endDate}T00:00:00`);
    const lengthDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return r2((amount / lengthDays) * DAYS_PER_MONTH);
  }
  const months = Math.max(1, Number(p.months) || 1);
  return r2(amount / months);
}

// Écarts budget/réel à une date de référence donnée. Chaque budget porte sa
// PROPRE période (voir getPeriodBounds) — un budget hebdomadaire et un budget
// annuel évalués le même jour n'analysent donc pas la même fenêtre de dates.
// budgets: [{ account, amount, period }]. Convention gestion budgétaire :
// écart = réel − budget ; compte de charges → écart > 0 défavorable ;
// compte de produits → écart > 0 favorable.
export function budgetVariance(journal, budgets, refDate, accountMap = ACCOUNT_MAP) {
  const ref = refDate || new Date().toISOString().slice(0, 10);
  return budgets.map((b) => {
    const period = getPeriodBounds(b.period, ref);
    const balances = accountBalances(journal, period);
    const cls = classOf(b.account);
    const bal = balances[b.account];
    const reel = r2(cls === 7 ? -(bal?.balance || 0) : bal?.balance || 0);
    const ecart = r2(reel - b.amount);
    const favorable = cls === 7 ? ecart >= 0 : ecart <= 0;
    const realisation = b.amount > 0 ? r2((reel / b.amount) * 100) : null;
    return { ...b, cls, label: accountMap[b.account]?.label || b.account, reel, ecart, favorable, realisation, bounds: period, periodLabel: periodLabel(b.period, period) };
  });
}

// ─────────────────────────── Raisonnement budgétaire ───────────────────────────
// Va plus loin que l'écart budget/réel : regarde CE QUI a été acheté/encaissé
// dans la période (par tiers), compare au comportement passé, projette la fin
// de période au rythme actuel, et signale les mouvements inhabituels.

// Mouvements d'un compte sur une période, groupés par libellé (tiers/motif) —
// répond à "qu'est-ce que j'ai acheté ?", pas juste "combien au total ?".
// Signe unifié : positif = impact réel (charge payée ou produit encaissé),
// même convention que budgetVariance. Triés du plus gros au plus petit.
export function labelBreakdown(journal, account, period) {
  const cls = classOf(account);
  const byLabel = {};
  for (const e of journal) {
    if (!inPeriod(e.date, period)) continue;
    for (const l of e.lines) {
      if (l.account !== account) continue;
      const amount = cls === 7 ? (Number(l.credit) || 0) - (Number(l.debit) || 0) : (Number(l.debit) || 0) - (Number(l.credit) || 0);
      if (!amount) continue;
      const key = e.label || '(sans libellé)';
      const row = (byLabel[key] ??= { label: key, amount: 0, count: 0 });
      row.amount = r2(row.amount + amount);
      row.count += 1;
    }
  }
  return Object.values(byLabel).sort((a, b) => b.amount - a.amount);
}

// Les `n` périodes précédant celle en cours à `refDate`, même config de
// période — base de comparaison "vs mon comportement habituel", pas juste
// "vs mon plafond déclaré". Un custom non-récurrent est un événement ponctuel
// sans période précédente comparable → historique vide.
export function budgetHistory(journal, budget, refDate, n = 4) {
  const period = budget.period || DEFAULT_BUDGET_PERIOD;
  if (period.type === 'custom' && !period.recurring) return [];
  const cls = classOf(budget.account);
  const out = [];
  let boundaryDate = getPeriodBounds(period, refDate).from; // début de la période en cours
  for (let i = 0; i < n; i++) {
    const prevDay = new Date(`${boundaryDate}T00:00:00`);
    prevDay.setDate(prevDay.getDate() - 1);
    const bounds = getPeriodBounds(period, dateKey(prevDay));
    const balances = accountBalances(journal, bounds);
    const bal = balances[budget.account];
    const reel = r2(cls === 7 ? -(bal?.balance || 0) : bal?.balance || 0);
    out.unshift({ bounds, label: periodLabel(period, bounds), amount: reel });
    boundaryDate = bounds.from;
  }
  return out;
}

// Où on en est dans la période EN COURS (celle qui contient `today`) et
// projection linéaire du total en fin de période au rythme actuel. `null` si
// `today` tombe hors de cette période (période passée ou future — la
// projection n'a de sens qu'en cours de route).
export function budgetPace(reel, bounds, today) {
  const start = new Date(`${bounds.from}T00:00:00`);
  const end = new Date(`${bounds.to}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  if (t < start || t > end) return null;
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const elapsedDays = Math.round((t - start) / 86400000) + 1;
  const projected = r2((reel / elapsedDays) * totalDays);
  return { elapsedDays, totalDays, elapsedPct: r2((elapsedDays / totalDays) * 100), projected };
}

// Mouvements de la période dont le montant dépasse nettement la taille
// moyenne des transactions HISTORIQUES de ce compte (× `threshold`, défaut
// 2×) — signale une dépense/encaissement inhabituel, distinct d'un simple
// dépassement de plafond. La moyenne se calcule hors période analysée pour ne
// pas être biaisée par la transaction qu'on est en train de juger ; si le
// compte a moins de 3 mouvements d'historique, aucun jugement n'est rendu.
export function budgetAnomalies(journal, account, period, threshold = 2) {
  const cls = classOf(account);
  const history = [];
  const inWindow = [];
  for (const e of journal) {
    for (const l of e.lines) {
      if (l.account !== account) continue;
      const amount = cls === 7 ? (Number(l.credit) || 0) - (Number(l.debit) || 0) : (Number(l.debit) || 0) - (Number(l.credit) || 0);
      if (amount <= 0) continue;
      const row = { date: e.date, label: e.label, amount: r2(amount) };
      if (inPeriod(e.date, period)) inWindow.push(row);
      else history.push(amount);
    }
  }
  if (history.length < 3) return [];
  const avg = history.reduce((a, x) => a + x, 0) / history.length;
  return inWindow.filter((x) => x.amount > avg * threshold).sort((a, b) => b.amount - a.amount);
}

// Vue d'ensemble "raisonnée" d'un budget à une date de référence : combine
// répartition par tiers, comparaison historique, rythme/projection et
// anomalies — ce qui alimente le panneau de détails dans l'UI Budget.
export function budgetInsights(journal, budget, refDate, accountMap = ACCOUNT_MAP) {
  const period = budget.period || DEFAULT_BUDGET_PERIOD;
  const ref = refDate || new Date().toISOString().slice(0, 10);
  const bounds = getPeriodBounds(period, ref);
  const cls = classOf(budget.account);
  const balances = accountBalances(journal, bounds);
  const bal = balances[budget.account];
  const reel = r2(cls === 7 ? -(bal?.balance || 0) : bal?.balance || 0);

  const topLabels = labelBreakdown(journal, budget.account, bounds).filter((x) => x.amount > 0);
  const history = budgetHistory(journal, budget, ref, 4);
  const historyAvg = history.length ? r2(history.reduce((a, x) => a + x.amount, 0) / history.length) : null;
  const vsHistoryPct = historyAvg ? r2(((reel - historyAvg) / Math.abs(historyAvg)) * 100) : null;
  const pace = budgetPace(reel, bounds, new Date().toISOString().slice(0, 10));
  const anomalies = budgetAnomalies(journal, budget.account, bounds);

  return {
    bounds, periodLabel: periodLabel(period, bounds), reel,
    topLabels, history, historyAvg, vsHistoryPct, pace, anomalies,
    label: accountMap[budget.account]?.label || budget.account,
  };
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
// du solde budgété mensuel (Σ budgets produits − Σ budgets charges), chaque
// budget étant ramené à son équivalent mensuel quelle que soit sa période
// (voir budgetMonthlyEquivalent) pour que hebdomadaire/trimestriel/annuel se
// comparent sur la même base.
export function treasuryForecast(journal, budgets, monthsAhead = 6) {
  const balances = accountBalances(journal);
  const soldeActuel = sumClass(balances, 5);
  const budgetNet = r2(
    budgets.reduce((a, b) => a + (classOf(b.account) === 7 ? budgetMonthlyEquivalent(b) : -budgetMonthlyEquivalent(b)), 0)
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

// ─── Échéances & prévisions v2 (jour par jour) ───
// Échéance : { id, label, templateId (income|expense|invest|borrow|repay),
//   debitAccount, creditAccount, amount, dueDate, recurrence:'once'|'monthly'|
//   'quarterly'|'yearly', endDate, active, paidDates:[] }
// templateId reprend les modèles de ENTRY_TEMPLATES (chart-of-accounts.js) :
// income (produit↔trésorerie), expense (charge↔trésorerie/dette CT),
// invest (immobilisation↔trésorerie), borrow (emprunt reçu), repay (remboursement).
// Rétro-compatibilité : les échéances créées avant cette généralisation portent
// encore type:'produit'|'charge' + natureAccount + treasuryAccount — resolveEcheanceLines
// les retraduit à la volée, aucune migration de données nécessaire.
export function resolveEcheanceLines(ech) {
  if (ech.debitAccount && ech.creditAccount) return { debitAccount: ech.debitAccount, creditAccount: ech.creditAccount };
  return ech.type === 'produit'
    ? { debitAccount: ech.treasuryAccount, creditAccount: ech.natureAccount }
    : { debitAccount: ech.natureAccount, creditAccount: ech.treasuryAccount };
}

// Impact sur la trésorerie (classe 5) d'un mouvement débit(X)/crédit(X) :
// +X si le débit est en classe 5, −X si le crédit l'est, 0 sinon (ex : une
// charge payée par carte de crédit — classe 4 — ne touche pas la trésorerie
// tout de suite, seule la dette augmente).
function treasuryDelta(debitAccount, creditAccount, amount) {
  let d = 0;
  if (classOf(debitAccount) === 5) d += amount;
  if (classOf(creditAccount) === 5) d -= amount;
  return r2(d);
}

// Impact sur l'ANC (Actif − Dettes) d'un mouvement débit(X)/crédit(X), général
// à TOUTE écriture en partie double : un débit sur un compte d'actif (2/3/5)
// l'augmente (+X) ; un débit sur une dette (1/4) la réduit, donc ANC += X ; un
// crédit sur une dette l'augmente, ANC -= X ; un crédit sur un actif le réduit,
// ANC -= X. Les comptes 6/7 (résultat) ne contribuent jamais directement ici —
// leur effet est déjà entièrement capté par la ligne 5 en face (une charge
// payée cash réduit l'actif ; une charge à crédit augmente la dette — les deux
// cas sont couverts par les règles ci-dessus sans traiter 6/7 à part). C'est
// ce qui rend un emprunt/investissement "neutre en patrimoine" automatiquement :
// invest (actif+X, trésorerie−X) et repay (dette−X via débit, trésorerie−X)
// se compensent à 0, exactement comme il se doit économiquement.
function ancDelta(debitAccount, creditAccount, amount) {
  let d = 0;
  const dc = classOf(debitAccount);
  const cc = classOf(creditAccount);
  if (dc === 2 || dc === 3 || dc === 5) d += amount;
  if (dc === 1 || dc === 4) d += amount;
  if (cc === 1 || cc === 4) d -= amount;
  if (cc === 2 || cc === 3 || cc === 5) d -= amount;
  return r2(d);
}

// mon=1..sun=0, convention Date.getDay() — même valeurs 'mon'..'sun' que
// utils/constants.js#WEEKDAYS (habitudes), sans en dépendre (fichier autonome).
const WEEKDAY_JS_DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// Étale une échéance récurrente en occurrences concrètes dans [fromDate, toDate]
// (bornes incluses, chaînes 'YYYY-MM-DD'), en excluant les occurrences déjà
// réglées (paidDates). Approximation calendaire simple pour monthly/quarterly/
// yearly : avance de N mois via Date(y, m+N, d) — une échéance fixée au 31 peut
// glisser sur un mois plus court (Date le normalise), acceptable pour une
// prévision, pas un relevé. weekly avance de 7 jours pile, sans cette dérive —
// la 1ère occurrence est calée sur ech.weekday à partir de dueDate (le jour de
// la semaine choisi prime sur le jour du mois de dueDate).
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
  let d = new Date(ech.dueDate + 'T00:00:00');
  const isWeekly = ech.recurrence === 'weekly';
  if (isWeekly && ech.weekday && WEEKDAY_JS_DAY[ech.weekday] != null) {
    const targetDay = WEEKDAY_JS_DAY[ech.weekday];
    while (d.getDay() !== targetDay) d.setDate(d.getDate() + 1);
  }
  const stepMonths = isWeekly ? null : { monthly: 1, quarterly: 3, yearly: 12 }[ech.recurrence] || 1;
  let guard = 0; // filet de sécurité anti-boucle-infinie, jamais censé être atteint
  while (d <= to && guard < 600) {
    guard++;
    if (end && d > end) break;
    const key = d.toISOString().slice(0, 10);
    if (d >= from && !paid.has(key)) out.push(key);
    d = isWeekly ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : new Date(d.getFullYear(), d.getMonth() + stepMonths, d.getDate());
  }
  return out;
}

// Série des `months` derniers soldes mensuels réels, par compte (classes 6 &
// 7) — brique commune aux méthodes SMA/EMA ci-dessous. Signe unifié : credit −
// debit sur la ligne classe 6/7 = impact trésorerie de sa contrepartie classe
// 5 (un produit crédité = encaissement ; une charge débitée = décaissement).
function monthlyBucketsByAccount(journal, months = 3) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const byAccount = {};
  for (const e of journal) {
    const mk = e.date.slice(0, 7);
    if (!keys.includes(mk)) continue;
    for (const l of e.lines) {
      const cls = classOf(l.account);
      if (cls !== 6 && cls !== 7) continue;
      const acc = (byAccount[l.account] ??= Object.fromEntries(keys.map((k) => [k, 0])));
      acc[mk] += l.credit - l.debit;
    }
  }
  return { keys, byAccount };
}

// Méthode 1 · Moyenne mobile (SMA) : moyenne simple des `months` derniers mois
// — chaque mois pèse pareil, réagit lentement à un changement d'habitude.
function smaByAccount(journal, months = 3) {
  const { keys, byAccount } = monthlyBucketsByAccount(journal, months);
  return Object.fromEntries(Object.entries(byAccount).map(([acct, series]) => [acct, keys.reduce((a, k) => a + series[k], 0) / months]));
}

// Méthode 2 · Moyenne mobile exponentielle (EMA) : pondère les mois récents
// plus fort (lissage standard α = 2/(N+1)) — plus réactive à une habitude qui
// change, quitte à être plus sensible à un mois atypique isolé.
function emaByAccount(journal, months = 3) {
  const { keys, byAccount } = monthlyBucketsByAccount(journal, months);
  const alpha = 2 / (months + 1);
  return Object.fromEntries(
    Object.entries(byAccount).map(([acct, series]) => {
      let ema = series[keys[0]];
      for (let i = 1; i < keys.length; i++) ema = alpha * series[keys[i]] + (1 - alpha) * ema;
      return [acct, ema];
    })
  );
}

// Méthode 3 · Budget (perspectives déclarées) : ne regarde PAS l'historique
// réel, mais ce que l'utilisateur a lui-même planifié pour chaque compte dans
// l'onglet Budget — "se capitalise sur les perspectives futures" plutôt que
// sur le passé. Un compte sans budget défini contribue 0 (ni optimiste ni
// pessimiste par défaut). Chaque budget est ramené à son équivalent mensuel
// (voir budgetMonthlyEquivalent), quelle que soit sa période propre.
function budgetByAccount(budgets) {
  return Object.fromEntries((budgets || []).map((b) => [b.account, classOf(b.account) === 7 ? budgetMonthlyEquivalent(b) : -budgetMonthlyEquivalent(b)]));
}

const HABIT_METHODS = { sma: smaByAccount, ema: emaByAccount };

// Prévision de trésorerie v2, jour par jour sur `days` jours : solde actuel +
// une base mensuelle sur les comptes SANS échéance active qui les couvre (pour
// ne pas compter deux fois le même flux), calculée selon `method` — 'sma'
// (moyenne mobile, défaut), 'ema' (moyenne mobile exponentielle, réagit plus
// vite à un changement d'habitude), ou 'budget' (perspectives déclarées : ce
// que l'utilisateur a planifié dans l'onglet Budget, pas l'historique réel) —
// + échéances (montants et dates exacts, tous types confondus — produit/
// charge/emprunt/investissement/virement) + estimation optionnelle de payout
// trading. La base mensuelle et le payout sont lissés en quote-part
// quotidienne (simplification assumée : on ne prétend pas connaître le jour
// exact d'un flux non-échéancé). Chaque point de la série porte aussi
// `ancEcheance`, l'impact patrimoine (ANC) de ce même jour — voir ancDelta :
// nul pour un emprunt/investissement/virement (juste une conversion actif↔
// dette ou actif↔trésorerie), égal à l'impact trésorerie pour un produit/charge.
export function treasuryForecastV2(journal, echeances, { days = 90, tradingMonthlyPayout = 0, method = 'sma', budgets = [] } = {}) {
  const soldeActuel = treasuryBalance(journal);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  const endKey = endDate.toISOString().slice(0, 10);

  const activeEch = (echeances || []).filter((e) => e.active);
  // Seules les échéances dont une des deux jambes touche une classe 6/7
  // "couvrent" ce compte pour l'exclusion de l'habitude détectée — un emprunt/
  // investissement (classes 1/2/4/5 uniquement) ne recoupe jamais les habitudes,
  // qui ne portent que sur les comptes de résultat.
  const coveredAccounts = new Set(
    activeEch.flatMap((e) => {
      const { debitAccount, creditAccount } = resolveEcheanceLines(e);
      return [debitAccount, creditAccount].filter((a) => classOf(a) === 6 || classOf(a) === 7);
    })
  );
  const habitAvg = method === 'budget' ? budgetByAccount(budgets) : (HABIT_METHODS[method] || smaByAccount)(journal, 3);
  const freeHabitMonthly = r2(
    Object.entries(habitAvg).filter(([acct]) => !coveredAccounts.has(acct)).reduce((a, [, v]) => a + v, 0)
  );
  const dailyBaseline = (freeHabitMonthly + tradingMonthlyPayout) / 30;

  const echByDate = {};
  const ancByDate = {};
  for (const ech of activeEch) {
    const { debitAccount, creditAccount } = resolveEcheanceLines(ech);
    const amount = Number(ech.amount);
    for (const occDate of echeanceOccurrences(ech, todayKey, endKey)) {
      echByDate[occDate] = r2((echByDate[occDate] || 0) + treasuryDelta(debitAccount, creditAccount, amount));
      ancByDate[occDate] = r2((ancByDate[occDate] || 0) + ancDelta(debitAccount, creditAccount, amount));
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
    series.push({ date: key, label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), solde, echeance: echByDate[key] || 0, ancEcheance: ancByDate[key] || 0 });
  }
  return { soldeActuel, freeHabitMonthly, dailyBaseline, series, alerts, echeancesInWindow: Object.keys(echByDate).length };
}

// Prévision de patrimoine (ANCC) jour par jour : réutilise la trajectoire de
// trésorerie de treasuryForecastV2 — même habitude quotidienne (elle est
// toujours de nature "résultat", donc son impact ANC = son impact trésorerie,
// 1 pour 1) + l'impact ANC propre de chaque échéance (ancEcheance, voir plus
// haut — nul pour emprunt/investissement, égal à la trésorerie pour produit/
// charge). Le reste du bilan (immobilisé, créances, dettes existantes, hors
// mouvements échéancés) reste gelé à sa valeur actuelle : on ne prétend pas
// anticiper une acquisition ou un remboursement qui n'a pas été programmé en
// échéance — documenté dans l'UI plutôt que caché.
export function netWorthForecastV2(journal, corrections, echeances, { days = 90, tradingMonthlyPayout = 0, method = 'sma', budgets = [] } = {}) {
  const treso = treasuryForecastV2(journal, echeances, { days, tradingMonthlyPayout, method, budgets });
  const analysis = financialAnalysis(journal);
  const anccActuel = correctedNetWorth(analysis.anc, corrections).ancc;

  let anc = analysis.anc;
  const series = [];
  const alerts = [];
  for (const pt of treso.series) {
    anc = r2(anc + treso.dailyBaseline + pt.ancEcheance);
    const ancc = correctedNetWorth(anc, corrections).ancc;
    if (ancc < 0 && (!series.length || series[series.length - 1].ancc >= 0)) alerts.push({ date: pt.date, ancc });
    series.push({ date: pt.date, label: pt.label, ancc });
  }
  return { anccActuel, series, alerts };
}
