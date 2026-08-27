// Career pipeline PDF export — added 2026-08-27, same "every domain gets a
// polished PDF report" pattern as Trading/Engineering/Business. Cover banner,
// funnel stats + conversion rates, a hand-drawn stage-distribution bar chart,
// then a paginated table of every application. Self-contained helpers
// (gradientBar/progressBar) duplicated rather than shared — same convention
// trading-report-pdf.js already established (no shared pdf-helpers module
// exists yet in this codebase).
import { CAREER_STAGES } from './constants';

const NAVY = [12, 18, 38];
const CYAN = [0, 209, 255];
const CYAN_DARK = [0, 140, 179];
const INK = [26, 30, 40];
const MUTE = [120, 128, 140];
const GRID = [224, 228, 233];
const GOOD = [22, 163, 116];
const BAD = [220, 68, 68];
const WARN = [217, 150, 30];

const STAGE_COLOR = {
  Applied: MUTE, Screening: CYAN_DARK, Interview: WARN, Offer: [102, 51, 204], Accepted: GOOD, Rejected: BAD, Withdrawn: MUTE,
};

function gradientBar(doc, x, y, w, h, from, to, steps = 48) {
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepW, y, stepW + 0.5, h, 'F');
  }
}

function progressBar(doc, x, y, w, pct, color) {
  doc.setFillColor(...GRID);
  doc.roundedRect(x, y, w, 2.4, 1.2, 1.2, 'F');
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(2, (w * clamped) / 100), 2.4, 1.2, 1.2, 'F');
  }
}

export async function exportCareerReportPDF(applications, conversionStats) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 16, marginR = 16;
  const contentW = pageW - marginL - marginR;

  const active = applications.filter((a) => !['Accepted', 'Rejected', 'Withdrawn'].includes(a.stage)).length;
  const offers = applications.filter((a) => a.stage === 'Offer' || a.stage === 'Accepted').length;
  const byStage = CAREER_STAGES.map((s) => ({ name: s, count: applications.filter((a) => a.stage === s).length })).filter((s) => s.count > 0);
  const maxCount = Math.max(1, ...byStage.map((s) => s.count));

  // ── Cover banner ──
  gradientBar(doc, 0, 0, pageW, 36, NAVY, CYAN_DARK);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(20);
  doc.text('Career — Pipeline de candidatures', marginL, 18);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text(`${applications.length} candidature${applications.length !== 1 ? 's' : ''} au total`, marginL, 26);
  doc.setFontSize(8);
  doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW - marginR, 18, { align: 'right' });
  doc.setTextColor(0);

  let y = 48;

  // ── Stat grid ──
  const stat = (label, val, x, color) => {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTE);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...(color || INK));
    doc.text(val, x, y + 7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
  };
  const colW = contentW / 4;
  stat('Candidatures', String(applications.length), marginL);
  stat('En cours', String(active), marginL + colW);
  stat('Offres', String(offers), marginL + colW * 2, offers ? GOOD : undefined);
  stat('Applied → Interview', `${conversionStats.appliedToInterviewPct}%`, marginL + colW * 3);
  y += 16;

  doc.setDrawColor(...GRID);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ── Conversion funnel ──
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...INK);
  doc.text('Taux de conversion', marginL, y);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0);
  y += 6;
  const convRow = (label, count, of, pct) => {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTE);
    doc.text(label, marginL, y);
    doc.setTextColor(...INK);
    doc.text(`${count} / ${of} · ${pct}%`, pageW - marginR, y, { align: 'right' });
    progressBar(doc, marginL, y + 1.5, contentW, pct, CYAN_DARK);
    doc.setTextColor(0);
    y += 8;
  };
  convRow('Applied → Interview', conversionStats.interview, conversionStats.applied, conversionStats.appliedToInterviewPct);
  convRow('Interview → Offer', conversionStats.offer, conversionStats.interview, conversionStats.interviewToOfferPct);
  y += 6;

  // ── Stage distribution ──
  if (byStage.length) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Répartition par étape', marginL, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    const barH = 5, gap = 2.5;
    for (const s of byStage) {
      const w = (s.count / maxCount) * (contentW - 34);
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTE);
      doc.text(s.name, marginL, y + barH - 1.2);
      doc.setFillColor(...(STAGE_COLOR[s.name] || MUTE));
      doc.roundedRect(marginL + 28, y, Math.max(2, w), barH, 1, 1, 'F');
      doc.setTextColor(...INK);
      doc.text(String(s.count), marginL + 30 + w, y + barH - 1.2);
      doc.setTextColor(0);
      y += barH + gap;
    }
    y += 6;
  }

  // ── Application table ──
  if (applications.length) {
    doc.addPage();
    let py = 20;
    const cols = [
      { key: 'company', label: 'Entreprise', w: 34 },
      { key: 'role', label: 'Rôle', w: 34 },
      { key: 'domain', label: 'Domaine', w: 22 },
      { key: 'stage', label: 'Étape', w: 22 },
      { key: 'appliedDate', label: 'Candidature', w: 24 },
      { key: 'salary', label: 'Rémunération', w: 30 },
    ];
    const colX = [];
    { let x = marginL; for (const c of cols) { colX.push(x); x += c.w; } }

    const drawTableHeader = () => {
      gradientBar(doc, 0, 0, pageW, 16, NAVY, CYAN_DARK);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('Career — Candidatures', marginL, 10);
      doc.setTextColor(0);
      py = 24;
      doc.setFillColor(245, 246, 248);
      doc.rect(marginL, py - 4.6, contentW, 6.2, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(90);
      cols.forEach((c, i) => doc.text(c.label, colX[i] + 1.5, py - 0.8));
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0);
      doc.setDrawColor(...GRID);
      doc.line(marginL, py + 1, pageW - marginR, py + 1);
      py += 6.5;
    };

    drawTableHeader();
    const sorted = [...applications].sort((a, b) => (a.appliedDate < b.appliedDate ? 1 : -1));
    let zebra = 0;
    for (const a of sorted) {
      if (py > pageH - 16) { doc.addPage(); drawTableHeader(); zebra = 0; }
      if (zebra % 2 === 1) { doc.setFillColor(249, 250, 251); doc.rect(marginL, py - 4.4, contentW, 6, 'F'); }
      zebra++;
      doc.setFontSize(7);
      doc.setTextColor(...INK);
      doc.text(String(a.company || '—'), colX[0] + 1.5, py);
      doc.text(String(a.role || '—'), colX[1] + 1.5, py);
      doc.setTextColor(...MUTE);
      doc.text(String(a.domain || '—'), colX[2] + 1.5, py);
      doc.setTextColor(...(STAGE_COLOR[a.stage] || MUTE));
      doc.text(a.stage, colX[3] + 1.5, py);
      doc.setTextColor(...MUTE);
      doc.text(String(a.appliedDate || '—').slice(0, 10), colX[4] + 1.5, py);
      doc.text(String(a.salary || '—'), colX[5] + 1.5, py);
      doc.setTextColor(0);
      py += 6;
    }
  }

  // ── Footers ──
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GRID);
    doc.line(marginL, pageH - 11, pageW - marginR, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(...MUTE);
    doc.text('AUDAX · Career', marginL, pageH - 7);
    doc.text(`Page ${p} / ${total}`, pageW - marginR, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }

  doc.save(`audax-career-pipeline-${new Date().toISOString().slice(0, 10)}.pdf`);
}
