// Freelance invoices (Carrière n°4): totals and amount formatting shared by
// the store, the UI and the PDF.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function invoiceTotals(inv) {
  const subtotal = r2((inv?.lines || []).reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0));
  const vat = r2(subtotal * ((Number(inv?.vatRate) || 0) / 100));
  return { subtotal, vat, total: r2(subtotal + vat) };
}

/** 1234.5 → "1 234,50" with plain spaces (jsPDF's standard fonts have no narrow no-break space). */
export const fmtAmount = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');
export const fmtMoneyCur = (n, cur) => `${fmtAmount(n)} ${cur || ''}`.trim();

export const addDaysKey = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Sent invoices past their due date, most late first: [{ inv, daysLate }]. */
export function overdueInvoices(invoices, today) {
  return (invoices || [])
    .filter((i) => i.status === 'sent' && i.dueDate && i.dueDate < today)
    .map((inv) => ({ inv, daysLate: daysBetween(inv.dueDate, today) }))
    .sort((a, b) => b.daysLate - a.daysLate);
}

/** Money received per month (last `months` months, oldest first), converted with toBase(amount, currency). */
export function monthlyRevenue(engagements, today, months = 12, toBase = (a) => a) {
  const keys = [];
  const d = new Date(`${today.slice(0, 7)}-01T12:00:00`);
  for (let i = months - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1, 12);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  const by = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const e of engagements || []) {
    for (const p of e.payments || []) {
      const k = (p.date || '').slice(0, 7);
      if (k in by) by[k] += toBase(Number(p.amount) || 0, e.currency);
    }
  }
  return keys.map((k) => ({ month: k, amount: r2(by[k]) }));
}

/** A polite reminder, firmer after the first one. Plain text, ready to paste in an e-mail. */
export function reminderMessage(inv, engagement, settings, { daysLate, count = 0 } = {}) {
  const total = fmtMoneyCur(invoiceTotals(inv).total, inv.currency);
  const date = inv.dueDate ? inv.dueDate.split('-').reverse().join('/') : '';
  const who = settings?.issuerName || '';
  const opening = count === 0
    ? `Sauf erreur de ma part, la facture ${inv.number} de ${total}, arrivée à échéance le ${date}, n’a pas encore été réglée.`
    : `Je reviens vers vous au sujet de la facture ${inv.number} de ${total}, échue depuis le ${date} (${daysLate} jours de retard), toujours en attente de règlement.`;
  return [
    'Bonjour,',
    '',
    opening,
    count === 0 ? 'Il s’agit peut-être d’un simple oubli : pourriez-vous me confirmer la date de paiement prévue ?' : 'Merci de procéder au règlement dans les meilleurs délais, ou de me signaler tout problème.',
    settings?.bankDetails ? `\nCoordonnées de paiement :\n${settings.bankDetails}` : '',
    '',
    'Cordialement,',
    who,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
