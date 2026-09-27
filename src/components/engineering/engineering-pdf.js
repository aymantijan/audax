import { ENGINEERING_PROJECT_STAGES } from '../../utils/constants';
import { todayKey } from '../../utils/formatters';

export async function exportLabEntryPDF(entry) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(entry.title || 'Rapport de laboratoire', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${entry.date}${entry.course ? ` · ${entry.course}` : ''}`, 14, y);
  y += 10;
  doc.setTextColor(0);

  const section = (label, value) => {
    if (!value) return;
    doc.setFontSize(12);
    doc.text(label, 14, y);
    y += 6;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(value), 180);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 6;
    }
    y += 4;
  };

  if (entry.yieldPercent !== '' && entry.yieldPercent != null) section('Rendement', `${entry.yieldPercent}%`);
  section('Objectif', entry.objective);
  section('Protocole', entry.protocol);
  section('Réactifs / matériel', entry.reagents);
  section('Observations', entry.observations);
  section('Conclusion', entry.conclusion);

  doc.save(`audax-lab-${(entry.title || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${entry.date}.pdf`);
}

// Aggregate portfolio export — unlike exportLabEntryPDF (one experiment) and
// EngineeringProjectDetail's exportProjectPDF (one project), this compiles a
// CHOSEN subset of projects + lab entries into a single CV-style document —
// what a student would actually attach to an internship/job application.
// Same dynamic-import jsPDF pattern as every other PDF export in the app.
export async function exportPortfolioPDF({ projects, labEntries, userName }) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.text('Portfolio Ingénierie', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${userName ? `${userName} · ` : ''}Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, y);
  y += 10;
  doc.setTextColor(0);

  const ensureRoom = (needed) => { if (y + needed > 280) { doc.addPage(); y = 20; } };
  const section = (label, value, indent = 14) => {
    if (!value) return;
    ensureRoom(12);
    doc.setFontSize(9.5);
    doc.setTextColor(100);
    doc.text(label, indent, y);
    doc.setTextColor(0);
    y += 5;
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(String(value), pageW - indent - 14);
    for (const line of lines) { ensureRoom(6); doc.text(line, indent, y); y += 5; }
    y += 2;
  };

  if (projects.length) {
    ensureRoom(10);
    doc.setFontSize(13);
    doc.text(`Projets (${projects.length})`, 14, y);
    y += 8;
    for (const p of projects) {
      ensureRoom(14);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(p.name, 14, y);
      doc.setFont(undefined, 'normal');
      y += 5.5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      const tasks = p.tasks || [];
      const done = tasks.filter((t) => t.status === 'done').length;
      doc.text(`${p.type} · ${ENGINEERING_PROJECT_STAGES[p.stageIndex ?? 0]}${p.grade ? ` · note ${p.grade}` : ''}${p.deadline ? ` · échéance ${p.deadline}` : ''}${tasks.length ? ` · ${done}/${tasks.length} tâches` : ''}${(p.hazop || []).length ? ` · ${p.hazop.length} déviation(s) HAZOP` : ''}`, 14, y);
      y += 6;
      doc.setTextColor(0);
      section('Description', p.description);
      y += 2;
    }
    y += 4;
  }

  if (labEntries.length) {
    ensureRoom(10);
    doc.setFontSize(13);
    doc.text(`Expériences de laboratoire (${labEntries.length})`, 14, y);
    y += 8;
    for (const e of labEntries) {
      ensureRoom(12);
      doc.setFontSize(10.5);
      doc.setFont(undefined, 'bold');
      doc.text(e.title, 14, y);
      doc.setFont(undefined, 'normal');
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${e.date}${e.course ? ` · ${e.course}` : ''}${e.yieldPercent !== '' && e.yieldPercent != null ? ` · rendement ${e.yieldPercent}%` : ''}`, 14, y);
      y += 6;
      doc.setTextColor(0);
      section('Objectif', e.objective);
      section('Conclusion', e.conclusion);
      y += 2;
    }
  }

  doc.save(`audax-portfolio-ingenierie-${todayKey()}.pdf`);
}
