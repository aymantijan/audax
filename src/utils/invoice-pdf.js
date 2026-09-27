// Invoice PDF (Carrière n°4). Plain A4 layout: issuer, invoice number and
// dates, client block, lines table, totals (HT / TVA / TTC), payment details.
import { invoiceTotals, fmtAmount } from './invoice';

const INK = [26, 30, 40];
const MUTE = [110, 118, 130];
const ACCENT = [0, 140, 179];
const LINE = [220, 224, 230];
const dmy = (d) => (d ? d.split('-').reverse().join('/') : '');

export async function exportInvoicePDF(inv, engagement, settings) {
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
  txt('FACTURE', R, y, { size: 20, bold: true, color: ACCENT, align: 'right' });
  txt(`N° ${inv.number}`, R, y + 7, { size: 10, bold: true, align: 'right' });
  txt(`Date : ${dmy(inv.date)}`, R, y + 12.5, { size: 9, color: MUTE, align: 'right' });
  txt(`Échéance : ${dmy(inv.dueDate)}`, R, y + 17, { size: 9, color: MUTE, align: 'right' });
  y = Math.max(issuerEnd, y + 22) + 6;

  // Client
  doc.setFillColor(245, 247, 250); doc.roundedRect(108, y, R - 108, 30, 2, 2, 'F');
  txt('FACTURÉ À', 112, y + 6, { size: 8, bold: true, color: MUTE });
  txt(engagement.clientName, 112, y + 12, { size: 11, bold: true });
  block([engagement.clientAddress, engagement.clientEmail, engagement.clientTaxId], 112, y + 17, { size: 9, color: MUTE });
  if (engagement.description) { txt('Objet', L, y + 6, { size: 8, bold: true, color: MUTE }); block([engagement.description], L, y + 12, { size: 10 }); }
  y += 40;

  // Lines table
  const cols = { desc: L + 2, qty: 128, pu: 158, tot: R - 2 };
  doc.setFillColor(...ACCENT); doc.rect(L, y, R - L, 8, 'F');
  txt('Désignation', cols.desc, y + 5.5, { size: 9, bold: true, color: [255, 255, 255] });
  txt('Qté', cols.qty, y + 5.5, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
  txt(`Prix unit. (${cur})`, cols.pu, y + 5.5, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
  txt(`Total (${cur})`, cols.tot, y + 5.5, { size: 9, bold: true, color: [255, 255, 255], align: 'right' });
  y += 8;
  for (const l of inv.lines) {
    const parts = doc.splitTextToSize(l.description, 95);
    const h = Math.max(8, parts.length * 4.6 + 3.4);
    if (y + h > 250) { doc.addPage(); y = 22; }
    parts.forEach((p, i) => txt(p, cols.desc, y + 5.2 + i * 4.6, { size: 9.5 }));
    txt(String(l.qty).replace('.', ','), cols.qty, y + 5.2, { size: 9.5, align: 'right' });
    txt(fmtAmount(l.unitPrice), cols.pu, y + 5.2, { size: 9.5, align: 'right' });
    txt(fmtAmount(l.qty * l.unitPrice), cols.tot, y + 5.2, { size: 9.5, align: 'right' });
    y += h;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
  }

  // Totals
  const t = invoiceTotals(inv);
  y += 6;
  const row = (label, value, bold = false) => { txt(label, 150, y, { size: bold ? 11 : 9.5, bold, align: 'right' }); txt(`${fmtAmount(value)} ${cur}`, R - 2, y, { size: bold ? 11 : 9.5, bold, align: 'right' }); y += bold ? 7 : 5.5; };
  row('Total HT', t.subtotal);
  if (Number(inv.vatRate) > 0) row(`TVA ${String(inv.vatRate).replace('.', ',')} %`, t.vat);
  row(Number(inv.vatRate) > 0 ? 'Total TTC' : 'Total à payer', t.total, true);

  // Payment + notes + footer
  y += 6;
  if (settings.bankDetails) { txt('Règlement', L, y, { size: 9, bold: true }); y = block([settings.bankDetails], L, y + 5, { size: 9, color: MUTE }) + 2; }
  txt(`Paiement attendu avant le ${dmy(inv.dueDate)}.`, L, y, { size: 9, color: MUTE }); y += 6;
  if (inv.notes) y = block([inv.notes], L, y, { size: 9, color: MUTE }) + 2;
  if (inv.status === 'paid') { doc.setDrawColor(22, 163, 116); doc.setLineWidth(0.8); doc.roundedRect(R - 44, 60, 40, 12, 2, 2); txt(`PAYÉE ${dmy(inv.paidAt)}`, R - 24, 67.8, { size: 10, bold: true, color: [22, 163, 116], align: 'center' }); }
  if (settings.footer) { txt(settings.footer, 105, 287, { size: 8, color: MUTE, align: 'center' }); }

  const file = `${inv.number}.pdf`;
  doc.save(file);
  return file;
}
