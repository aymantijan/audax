// Invoice and quote PDF (Carrière n°4). Plain A4 layout: issuer, number and
// dates, client block, lines table, totals (HT / TVA / TTC), then payment details
// (invoice) or validity and a signature box (quote).
import { invoiceTotals, fmtAmount } from './invoice';

const INK = [26, 30, 40];
const MUTE = [110, 118, 130];
const ACCENT = [42, 20, 32]; // VAUDAX porphyry
const LINE = [220, 224, 230];
const dmy = (d) => (d ? d.split('-').reverse().join('/') : '');

export async function exportInvoicePDF(inv, engagement, settings, { kind = 'invoice' } = {}) {
  const quote = kind === 'quote';
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 18; const R = 192;
  const cur = inv.currency || '';
  let y = 22;
  const txt = (s, x, yy, { size = 10, bold = false, color = INK, align } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(String(s), x, yy, align ? { align } : undefined);
  };
  const block = (lines, x, yy, opts) => { let yy2 = yy; for (const l of lines.filter(Boolean)) { for (const part of doc.splitTextToSize(String(l), 80)) { txt(part, x, yy2, opts); yy2 += 4.6; } } return yy2; };

  // Issuer (left) + title (right)
  txt(settings.issuerName || 'Votre nom', L, y, { size: 13, bold: true });
  const issuerEnd = block([settings.issuerAddress, settings.issuerEmail, settings.issuerPhone, settings.taxIds], L, y + 6, { size: 9, color: MUTE });
  txt(quote ? 'DEVIS' : 'FACTURE', R, y, { size: 20, bold: true, color: ACCENT, align: 'right' });
  txt(`N° ${inv.number}`, R, y + 7, { size: 10, bold: true, align: 'right' });
  txt(`Date : ${dmy(inv.date)}`, R, y + 12.5, { size: 9, color: MUTE, align: 'right' });
  txt(quote ? `Valable jusqu’au : ${dmy(inv.validUntil)}` : `Échéance : ${dmy(inv.dueDate)}`, R, y + 17, { size: 9, color: MUTE, align: 'right' });
  y = Math.max(issuerEnd, y + 22) + 6;

  // Client
  doc.setFillColor(245, 247, 250); doc.roundedRect(108, y, R - 108, 30, 2, 2, 'F');
  txt(quote ? 'ADRESSÉ À' : 'FACTURÉ À', 112, y + 6, { size: 8, bold: true, color: MUTE });
  txt(engagement.clientName, 112, y + 12, { size: 11, bold: true });
  block([engagement.clientAddress, engagement.clientEmail, engagement.clientTaxId], 112, y + 17, { size: 9, color: MUTE });
  if (engagement.description) { txt('Objet', L, y + 6, { size: 8, bold: true, color: MUTE }); block([engagement.description], L, y + 12, { size: 10 }); }
  y += 40;

  // Lines table: description, quantity, unit, unit price, VAT (when rates differ), total excl. tax
  const t = invoiceTotals(inv);
  const rates = [...new Set(inv.lines.map((l) => Number(l.vatRate ?? inv.vatRate) || 0))];
  const showVat = rates.length > 1;
  const hasDisc = inv.lines.some((l) => Number(l.discountPct) > 0);
  const cols = { desc: L + 2, qty: 112, unit: 116, pu: 152, vat: 164, tot: R - 2 };
  doc.setFillColor(...ACCENT); doc.rect(L, y, R - L, 8, 'F');
  const white = { size: 8.5, bold: true, color: [255, 255, 255] };
  txt('Désignation', cols.desc, y + 5.5, white);
  txt('Qté', cols.qty, y + 5.5, { ...white, align: 'right' });
  txt('Unité', cols.unit, y + 5.5, white);
  txt(`P.U. (${cur})`, cols.pu, y + 5.5, { ...white, align: 'right' });
  if (showVat) txt('TVA', cols.vat, y + 5.5, white);
  txt(`Total HT (${cur})`, cols.tot, y + 5.5, { ...white, align: 'right' });
  y += 8;
  for (const l of inv.lines) {
    const disc = Number(l.discountPct) || 0;
    const text = disc ? `${l.description} (remise ${String(disc).replace('.', ',')} %)` : l.description;
    const parts = doc.splitTextToSize(text, 80);
    const h = Math.max(8, parts.length * 4.6 + 3.4);
    if (y + h > 250) { doc.addPage(); y = 22; }
    parts.forEach((pp, i) => txt(pp, cols.desc, y + 5.2 + i * 4.6, { size: 9 }));
    txt(String(l.qty).replace('.', ','), cols.qty, y + 5.2, { size: 9, align: 'right' });
    txt(l.unit || '', cols.unit, y + 5.2, { size: 8.5, color: MUTE });
    txt(fmtAmount(l.unitPrice), cols.pu, y + 5.2, { size: 9, align: 'right' });
    if (showVat) txt(`${String(Number(l.vatRate ?? inv.vatRate) || 0).replace('.', ',')} %`, cols.vat, y + 5.2, { size: 8.5, color: MUTE });
    txt(fmtAmount(l.qty * l.unitPrice * (1 - disc / 100)), cols.tot, y + 5.2, { size: 9, align: 'right' });
    y += h;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  }

  // Totals
  y += 6;
  if (y > 240) { doc.addPage(); y = 22; }
  const row = (label, value, bold = false) => { txt(label, 150, y, { size: bold ? 11 : 9.5, bold, align: 'right' }); txt(`${fmtAmount(value)} ${cur}`, R - 2, y, { size: bold ? 11 : 9.5, bold, align: 'right' }); y += bold ? 7 : 5.5; };
  if (hasDisc || Number(inv.discountPct) > 0) {
    row('Total brut HT', t.gross);
    row(Number(inv.discountPct) > 0 && !hasDisc ? `Remise ${String(inv.discountPct).replace('.', ',')} %` : 'Remises', -t.discount);
  }
  row('Total HT', t.subtotal);
  for (const [r, v] of Object.entries(t.vatByRate)) row(`TVA ${String(r).replace('.', ',')} %`, v);
  const last = !(t.withholding > 0) && !(t.deposit > 0);
  row(t.vat ? 'Total TTC' : 'Total', t.total, last);
  if (t.withholding > 0) row(`Retenue à la source ${String(inv.withholdingPct).replace('.', ',')} %`, -t.withholding);
  if (t.deposit > 0) row('Acompte déjà versé', -t.deposit);
  if (!last) row('Net à payer', t.due, true);

  // Payment + notes + footer
  y += 6;
  if (quote) {
    txt(`Devis valable jusqu’au ${dmy(inv.validUntil)}.`, L, y, { size: 9, color: MUTE }); y += 8;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.roundedRect(120, y, R - 120, 28, 2, 2);
    txt('Bon pour accord — date et signature', 124, y + 6, { size: 8, bold: true, color: MUTE });
    y += 34;
  } else {
    if (settings.bankDetails) { txt('Règlement', L, y, { size: 9, bold: true }); y = block([settings.bankDetails], L, y + 5, { size: 9, color: MUTE }) + 2; }
    txt(`Paiement attendu avant le ${dmy(inv.dueDate)}.`, L, y, { size: 9, color: MUTE }); y += 6;
  }
  if (inv.notes) y = block([inv.notes], L, y, { size: 9, color: MUTE }) + 2;
  if (inv.status === 'paid') { doc.setDrawColor(22, 163, 116); doc.setLineWidth(0.8); doc.roundedRect(R - 44, 60, 40, 12, 2, 2); txt(`PAYÉE ${dmy(inv.paidAt)}`, R - 24, 67.8, { size: 10, bold: true, color: [22, 163, 116], align: 'center' }); }
  if (settings.footer) { txt(settings.footer, 105, 287, { size: 8, color: MUTE, align: 'center' }); }

  const file = `${inv.number}.pdf`;
  doc.save(file);
  return file;
}
