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
