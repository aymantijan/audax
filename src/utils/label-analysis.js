// Analyse des écritures par libellé (ex : "Omar's Café" au sein du compte
// 622 — Restaurants & cafés) — complète l'analyse par compte déjà en place
// (accounting-engine.js) avec une granularité plus fine que l'utilisateur
// contrôle lui-même (autocomplétion, "voulez-vous dire ?", limites de ratio).

import { ACCOUNT_MAP, classOf } from './chart-of-accounts';
import { monthKey } from './accounting-engine';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const normalizeLabel = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Distance de Levenshtein standard (matrice DP) — labels utilisateur, jamais
// assez longs pour que la complexité O(n·m) pose problème ici.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// 0 (rien en commun) .. 1 (identique), normalisée par la longueur du plus long des deux.
export function labelSimilarity(a, b) {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen ? 1 - levenshtein(na, nb) / maxLen : 0;
}

// Tous les libellés déjà saisis sur des écritures touchant ce compte (côté
// débité, donc les dépenses réelles), avec fréquence, montant total et date
// de dernière utilisation — sert à l'autocomplétion et au tableau d'analyse.
export function getLabelsForAccount(journal, account) {
  const map = new Map(); // key = libellé normalisé → { label (original le + récent), count, total, lastUsed }
  for (const e of journal) {
    const line = e.lines.find((l) => l.account === account && Number(l.debit) > 0);
    if (!line || !e.label?.trim()) continue;
    const key = normalizeLabel(e.label);
    const existing = map.get(key);
    const amount = Number(line.debit) || 0;
    if (existing) {
      existing.count += 1;
      existing.total = r2(existing.total + amount);
      if (e.date >= existing.lastUsed) { existing.lastUsed = e.date; existing.label = e.label.trim(); }
    } else {
      map.set(key, { label: e.label.trim(), count: 1, total: r2(amount), lastUsed: e.date });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (b.lastUsed > a.lastUsed ? 1 : -1));
}

// Suggestions d'autocomplétion pour le champ Libellé, filtrées par le compte
// sélectionné — "les libellés déjà utilisés pour ce même compte de dépense".
export function suggestLabels(journal, account, query = '', limit = 8) {
  const labels = getLabelsForAccount(journal, account);
  const q = normalizeLabel(query);
  if (!q) return labels.slice(0, limit);
  return labels
    .filter((l) => normalizeLabel(l.label).includes(q))
    .sort((a, b) => {
      const aStarts = normalizeLabel(a.label).startsWith(q) ? 0 : 1;
      const bStarts = normalizeLabel(b.label).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || b.count - a.count;
    })
    .slice(0, limit);
}

// "Voulez-vous dire : X ?" — le libellé existant le plus proche du texte saisi
// pour ce compte, si suffisamment similaire mais PAS déjà une saisie exacte.
export function findClosestLabel(journal, account, inputLabel, threshold = 0.72) {
  const q = normalizeLabel(inputLabel);
  if (!q || q.length < 3) return null;
  const labels = getLabelsForAccount(journal, account);
  if (labels.some((l) => normalizeLabel(l.label) === q)) return null; // déjà exact
  let best = null;
  for (const l of labels) {
    const sim = labelSimilarity(l.label, inputLabel);
    if (sim >= threshold && (!best || sim > best.similarity)) best = { label: l.label, similarity: sim };
  }
  return best;
}

// Dépense totale portant exactement ce libellé sur ce compte, sur une période
// optionnelle { from, to } (sinon tout l'historique).
export function labelSpendTotal(journal, account, label, period) {
  const q = normalizeLabel(label);
  let total = 0;
  for (const e of journal) {
    if (period && !((!period.from || e.date >= period.from) && (!period.to || e.date <= period.to))) continue;
    if (normalizeLabel(e.label) !== q) continue;
    const line = e.lines.find((l) => l.account === account && Number(l.debit) > 0);
    if (line) total += Number(line.debit) || 0;
  }
  return r2(total);
}

// Total des revenus (classe 7, hors exceptionnel) sur une période — dénominateur
// du ratio "libellé / revenus".
export function totalIncome(journal, period) {
  let total = 0;
  for (const e of journal) {
    if (period && !((!period.from || e.date >= period.from) && (!period.to || e.date <= period.to))) continue;
    for (const l of e.lines) {
      if (classOf(l.account) === 7 && !ACCOUNT_MAP[l.account]?.exceptional) total += Number(l.credit) || 0;
    }
  }
  return r2(total);
}

// Total dépensé sur un compte de charge donné (tous libellés confondus) sur une
// période — dénominateur du ratio "libellé / poste de dépense".
export function accountSpendTotal(journal, account, period) {
  let total = 0;
  for (const e of journal) {
    if (period && !((!period.from || e.date >= period.from) && (!period.to || e.date <= period.to))) continue;
    const line = e.lines.find((l) => l.account === account && Number(l.debit) > 0);
    if (line) total += Number(line.debit) || 0;
  }
  return r2(total);
}

const periodOfMonth = (date) => { const mk = monthKey(date); return { from: `${mk}-01`, to: `${mk}-31` }; };

// Simule les deux ratios de contrôle APRÈS ajout d'un montant donné, sur le mois
// de l'écriture — { spendWithLabel, income, accountSpend, ratioToIncome, ratioToAccountSpend }.
// Les ratios à dénominateur nul sont `null` (pas encore assez de données pour juger).
export function computeLabelRatiosAfter(journal, { account, label, amount, date }) {
  const period = periodOfMonth(date);
  const spendBefore = labelSpendTotal(journal, account, label, period);
  const spendAfter = r2(spendBefore + amount);
  const income = totalIncome(journal, period);
  const accountSpendBefore = accountSpendTotal(journal, account, period);
  const accountSpendAfter = r2(accountSpendBefore + amount);
  return {
    spendAfter,
    income,
    accountSpendAfter,
    ratioToIncome: income > 0 ? r2((spendAfter / income) * 100) : null,
    ratioToAccountSpend: accountSpendAfter > 0 ? r2((spendAfter / accountSpendAfter) * 100) : null,
  };
}
