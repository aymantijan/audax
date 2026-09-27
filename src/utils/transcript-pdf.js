// Personal transcript ("relevé de notes") as a PDF: every semester, each
// subject with coefficient, credits, average and status, then the overall
// average. Clearly marked as a personal document, not an official one.
import { overallResult, fmtGrade, STATUS_META, mentionFor } from './academic';
import { todayKey } from './formatters';

const BRAND = [42, 20, 32];
const GOLD = [134, 98, 28];
const INK = [34, 24, 30];
const MUTE = [123, 116, 112];
const GRID = [225, 222, 216];
const STATUS_RGB = { validated: [35, 112, 77], failed: [184, 58, 75], 'at-risk': [179, 107, 18], 'in-progress': [134, 98, 28], empty: [123, 116, 112] };

export async function exportTranscriptPDF({ name, terms, modules, courses, settings }) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 16;
  const mR = 16;
  const W = pageW - mL - mR;
  const overall = overallResult(terms, modules, courses, settings);
  const scale = settings.scale;
  const g = (v) => (v == null ? '—' : `${fmtGrade(v)}/${scale}`);

  const banner = () => {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 26, pageW, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(16);
    doc.text('Relevé de notes', mL, 13);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9.5);
    doc.text([name, settings.institution].filter(Boolean).join(' · '), mL, 20);
    doc.setFontSize(7.5);
    doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, pageW - mR, 13, { align: 'right' });
    doc.text('Document personnel, non officiel', pageW - mR, 19, { align: 'right' });
    doc.setTextColor(0);
  };

  const cols = [
    { label: 'Matière', w: 78 },
    { label: 'Coef.', w: 16, center: true },
    { label: 'Crédits', w: 18, center: true },
    { label: 'Moyenne', w: 26, center: true },
    { label: 'Statut', w: W - 138, center: true },
  ];
  const colX = [];
  { let x = mL; for (const c of cols) { colX.push(x); x += c.w; } }

  let y = 36;
  const newPageIfNeeded = (need) => { if (y + need > pageH - 18) { doc.addPage(); banner(); y = 36; } };
  banner();

  // Summary
  doc.setDrawColor(...GRID);
  doc.setFillColor(251, 249, 246);
  doc.roundedRect(mL, y, W, 20, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text('Moyenne générale', mL + 5, y + 7);
  doc.text('Crédits', mL + W / 2, y + 7);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...INK);
  const mention = mentionFor(overall.avg, settings);
  doc.text(`${g(overall.avg)}${mention ? `  ·  ${mention.label}` : ''}`, mL + 5, y + 15);
  doc.text(overall.creditsTotal ? `${overall.creditsEarned}/${overall.creditsTotal}` : '—', mL + W / 2, y + 15);
  doc.setFont(undefined, 'normal');
  y += 28;

  for (const t of overall.terms) {
    newPageIfNeeded(30);
    doc.setFillColor(246, 239, 224);
    doc.rect(mL, y, W, 9, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.line(mL, y, mL, y + 9);
    doc.setFontSize(10.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...INK);
    doc.text(`${t.term.name}${t.term.year ? ` · ${t.term.year}` : ''}`, mL + 3, y + 6);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTE);
    doc.text(`Moyenne ${g(t.avg)} · ${STATUS_META[t.status]?.label || ''}${t.creditsTotal ? ` · ${t.creditsEarned}/${t.creditsTotal} crédits` : ''}`, mL + W - 2, y + 6, { align: 'right' });
    y += 14;

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(90);
    cols.forEach((c, i) => doc.text(c.label, c.center ? colX[i] + c.w / 2 : colX[i] + 2, y, c.center ? { align: 'center' } : undefined));
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.2);
    doc.line(mL, y + 1.5, mL + W, y + 1.5);
    y += 6;

    const subjects = [...t.units, ...t.looseUnits].flatMap((u) => u.subjects.map((s) => ({ ...s, module: u.module })));
    if (!subjects.length) {
      doc.setTextColor(...MUTE);
      doc.text('Aucune matière.', mL + 2, y);
      y += 8;
      continue;
    }
    for (const { course, r } of subjects) {
      newPageIfNeeded(7);
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      const label = doc.splitTextToSize(course.name, cols[0].w - 3)[0];
      doc.text(label, colX[0] + 2, y);
      doc.setTextColor(70, 64, 66);
      doc.text(String(course.coefficient || 1), colX[1] + cols[1].w / 2, y, { align: 'center' });
      doc.text(course.credits ? String(course.credits) : '—', colX[2] + cols[2].w / 2, y, { align: 'center' });
      doc.setFont(undefined, 'bold');
      doc.text(g(r.value), colX[3] + cols[3].w / 2, y, { align: 'center' });
      doc.setFont(undefined, 'normal');
      const st = r.value == null ? 'empty' : r.complete ? (r.value >= (settings.subjectPassMark ?? settings.passMark) ? 'validated' : 'failed') : 'in-progress';
      doc.setTextColor(...(STATUS_RGB[st] || MUTE));
      doc.text(STATUS_META[st].label, colX[4] + cols[4].w / 2, y, { align: 'center' });
      doc.setDrawColor(240, 236, 230);
      doc.line(mL, y + 2, mL + W, y + 2);
      y += 6.5;
    }
    y += 6;
  }

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTE);
    doc.text(`VAUDAX · page ${p}/${total}`, pageW - mR, pageH - 8, { align: 'right' });
  }
  doc.save(`releve-de-notes-${todayKey()}.pdf`);
}
