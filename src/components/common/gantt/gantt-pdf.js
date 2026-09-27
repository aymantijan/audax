// PDF exports for the shared Gantt component (jsPDF, loaded on demand).
// Input is the same normalised shape the component uses:
//   title: document title (project / business name)
//   tasks: [{ id, name, startDate, endDate, milestone, progress, status, dependencies, groupId, order }]
//   groups: optional [{ id, name, order }] — phases; without them the chart is flat.
import { diffDays, addDaysKey, toDate, monthGroups, durationDays, computeCriticalPath } from '../../../utils/gantt';
import { todayKey } from '../../../utils/formatters';

// VAUDAX colours in RGB (jsPDF does not read CSS variables).
const PDF_BRAND = [42, 20, 32]; // porphyry
const PDF_BRAND_LIGHT = [246, 239, 224]; // vellum
const PDF_GOLD = [134, 98, 28];
const PDF_GRID = [225, 222, 216];
const PDF_MUTE = [123, 116, 112];
const PDF_INK = [34, 24, 30];
const PDF_CRITICAL = [184, 58, 75];
const TONES = {
  todo: { fill: [160, 152, 150], dark: [104, 96, 96], label: 'À faire' },
  progress: { fill: [227, 168, 87], dark: [179, 107, 18], label: 'En cours' },
  done: { fill: [58, 150, 110], dark: [35, 112, 77], label: 'Terminée' },
};
const toneOf = (status) => (status === 'done' ? TONES.done : status === 'in_progress' || status === 'in-progress' ? TONES.progress : TONES.todo);

function truncate(doc, text, maxW) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function diamond(doc, cx, cy, r, color) {
  doc.setFillColor(...color);
  doc.triangle(cx, cy - r, cx + r, cy, cx, cy + r, 'F');
  doc.triangle(cx, cy - r, cx - r, cy, cx, cy + r, 'F');
}

function stampFooters(doc, title, marginL, marginR, pageW, pageH) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_GRID);
    doc.line(marginL, pageH - 11, pageW - marginR, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTE);
    doc.text(title, marginL, pageH - 7);
    doc.text(`Page ${p} / ${total}`, pageW - marginR, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }
}

// Sections in display order: one per group (phase), or a single unnamed one.
function sections(tasks, groups) {
  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
  if (!groups) return [{ group: null, tasks: [...tasks].sort(byOrder) }];
  return [...groups].sort(byOrder).map((g) => ({ group: g, tasks: tasks.filter((t) => t.groupId === g.id).sort(byOrder) }));
}

export function numbering(tasks, groups) {
  const map = {};
  if (!groups) {
    sections(tasks, null)[0].tasks.forEach((t, i) => { map[t.id] = String(i + 1); });
    return map;
  }
  sections(tasks, groups).forEach((s, gi) => s.tasks.forEach((t, ti) => { map[t.id] = `${gi + 1}.${ti + 1}`; }));
  return map;
}

const fileBase = (title) => title.replace(/\s+/g, '-').toLowerCase();

function banner(doc, pageW, marginL, marginR, title, subtitle, right, height = 22) {
  doc.setFillColor(...PDF_BRAND);
  doc.rect(0, 0, pageW, height, 'F');
  doc.setFillColor(...PDF_GOLD);
  doc.rect(0, height, pageW, 0.8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(15);
  doc.text(title, marginL, 13);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, marginL, 19);
  doc.setFontSize(7.5);
  right.forEach((line, i) => doc.text(line, pageW - marginR, 12 + i * 5, { align: 'right' }));
  doc.setTextColor(0);
}

// The chart itself: bars, dependency arrows, critical path, month ruler,
// weekend stripes, phase headers when there are groups.
export async function exportGanttPDF({ title, tasks, groups = null }) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14, marginR = 14, marginB = 16;
  const chartXmm = 92;
  const chartRight = pageW - marginR;
  const chartWidth = chartRight - chartXmm;
  const generated = `Généré le ${new Date().toLocaleDateString('fr-FR')}`;

  if (!tasks.length) {
    banner(doc, pageW, marginL, marginR, title, 'Diagramme de Gantt', [generated]);
    doc.setFontSize(11);
    doc.setTextColor(...PDF_MUTE);
    doc.text('Aucune tâche planifiée.', marginL, 34);
    doc.save(`gantt-${fileBase(title)}.pdf`);
    return;
  }

  const min = [...tasks.map((t) => t.startDate)].sort()[0];
  const max = [...tasks.map((t) => t.endDate)].sort().slice(-1)[0];
  const totalDays = Math.max(1, diffDays(min, max) + 1);
  const dayW = chartWidth / totalDays;
  const xFor = (dateKey) => chartXmm + diffDays(min, dateKey) * dayW;
  const num = numbering(tasks, groups);
  const critical = computeCriticalPath(tasks);
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const chartTop = 44;
  const bodyBottom = pageH - marginB - 4;

  function legend(y) {
    const items = [
      { color: TONES.todo.fill, label: TONES.todo.label },
      { color: TONES.progress.fill, label: TONES.progress.label },
      { color: TONES.done.fill, label: TONES.done.label },
      { color: PDF_CRITICAL, label: 'Chemin critique', outline: true },
    ];
    let x = marginL;
    doc.setFontSize(7.3);
    for (const it of items) {
      if (it.outline) { doc.setDrawColor(...it.color); doc.setLineWidth(0.5); doc.roundedRect(x, y - 2.6, 3, 3, 0.5, 0.5, 'S'); }
      else { doc.setFillColor(...it.color); doc.roundedRect(x, y - 2.6, 3, 3, 0.5, 0.5, 'F'); }
      doc.setTextColor(...PDF_MUTE);
      doc.text(it.label, x + 4.2, y);
      x += doc.getTextWidth(it.label) + 13;
    }
    doc.setTextColor(0);
  }

  function monthRuler(y) {
    doc.setFillColor(248, 245, 239);
    doc.rect(chartXmm, y - 5, chartWidth, 6, 'F');
    let mx = chartXmm;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...PDF_MUTE);
    for (const g of monthGroups(min, max)) {
      const w = g.days * dayW;
      doc.text(g.label.toUpperCase(), mx + w / 2, y - 1, { align: 'center' });
      if (mx > chartXmm) { doc.setDrawColor(...PDF_GRID); doc.line(mx, y - 5, mx, y + 1); }
      mx += w;
    }
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    doc.setDrawColor(...PDF_GRID);
    doc.line(marginL, y + 1, chartRight, y + 1);
  }

  function weekendStripes(yTop, yBottom) {
    doc.setFillColor(250, 248, 244);
    for (let i = 0; i < totalDays; i++) {
      const dow = toDate(addDaysKey(min, i)).getDay();
      if (dow === 0 || dow === 6) doc.rect(chartXmm + i * dayW, yTop, dayW, yBottom - yTop, 'F');
    }
  }

  let page = 1;
  function startPage() {
    banner(doc, pageW, marginL, marginR, title, 'Diagramme de Gantt', [
      generated,
      `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} · ${doneCount} terminée${doneCount > 1 ? 's' : ''} · ${critical.size} critique${critical.size > 1 ? 's' : ''}`,
    ]);
    legend(29);
    monthRuler(38);
    weekendStripes(chartTop - 4, bodyBottom);
  }
  startPage();
  let y = chartTop;
  const newPage = () => { doc.addPage('a4', 'landscape'); page += 1; startPage(); y = chartTop; };

  const layout = {};
  let zebra = 0;
  for (const s of sections(tasks, groups)) {
    if (!s.tasks.length) continue;
    if (s.group) {
      if (y > bodyBottom - 9) newPage();
      doc.setFillColor(...PDF_BRAND_LIGHT);
      doc.rect(marginL, y - 4.4, chartRight - marginL, 6.2, 'F');
      doc.setDrawColor(...PDF_GOLD);
      doc.setLineWidth(0.9);
      doc.line(marginL, y - 4.4, marginL, y + 1.8);
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...PDF_INK);
      doc.text(truncate(doc, s.group.name, chartXmm - marginL - 6), marginL + 3, y);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0);
      y += 7;
    }
    for (const t of s.tasks) {
      if (y > bodyBottom) newPage();
      const isCritical = critical.has(t.id);
      if (zebra % 2 === 1) { doc.setFillColor(251, 249, 246); doc.rect(marginL, y - 4.6, chartRight - marginL, 6.4, 'F'); }
      zebra++;
      doc.setFontSize(7.2);
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : PDF_INK));
      doc.text(truncate(doc, `${num[t.id]}  ${t.name}`, chartXmm - marginL - 12), marginL + 3, y);
      doc.setFontSize(6.4);
      doc.setTextColor(...PDF_MUTE);
      doc.text(`${t.progress ?? 0}%`, chartXmm - 4, y, { align: 'right' });
      doc.setTextColor(0);

      const x1 = xFor(t.startDate);
      const w = Math.max(1.2, (diffDays(t.startDate, t.endDate) + 1) * dayW);
      const tone = toneOf(t.status);
      const fill = isCritical ? PDF_CRITICAL : tone.fill;
      const dark = isCritical ? [140, 36, 50] : tone.dark;
      if (t.milestone) {
        diamond(doc, x1 + 1, y - 1.8, 1.6, fill);
      } else {
        doc.setFillColor(...fill);
        doc.roundedRect(x1, y - 3.6, w, 3.4, 0.7, 0.7, 'F');
        const pct = Number(t.progress) || 0;
        if (pct > 0) {
          doc.setFillColor(...dark);
          doc.rect(x1, y - 3.6, Math.min(w, (w * pct) / 100), 3.4, 'F');
        }
      }
      layout[t.id] = { x1, x2: t.milestone ? x1 + 1 : x1 + w, y: y - 1.9, page };
      y += 6.4;
    }
    if (s.group) y += 2.4;
  }

  for (const t of tasks) {
    const succ = layout[t.id];
    if (!succ) continue;
    for (const depId of t.dependencies || []) {
      const pred = layout[depId];
      if (!pred || pred.page !== succ.page) continue;
      doc.setPage(pred.page);
      const isCritical = critical.has(depId) && critical.has(t.id);
      const c = isCritical ? PDF_CRITICAL : [176, 170, 166];
      doc.setDrawColor(...c);
      doc.setLineWidth(isCritical ? 0.35 : 0.18);
      const midX = pred.x2 + 1.6;
      doc.line(pred.x2, pred.y, midX, pred.y);
      doc.line(midX, pred.y, midX, succ.y);
      doc.line(midX, succ.y, succ.x1 - 0.6, succ.y);
      doc.setFillColor(...c);
      doc.triangle(succ.x1 - 1.3, succ.y - 0.65, succ.x1 - 1.3, succ.y + 0.65, succ.x1, succ.y, 'F');
    }
  }

  stampFooters(doc, title, marginL, marginR, pageW, pageH);
  doc.save(`gantt-${fileBase(title)}-${todayKey()}.pdf`);
}

// A printable task report (summary figures, one table per phase with status
// pills and critical tasks marked) to share progress without opening the app.
export async function exportTasksReportPDF({ title, tasks, groups = null }) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14, marginR = 14, marginB = 16;
  const contentW = pageW - marginL - marginR;
  const num = numbering(tasks, groups);
  const critical = computeCriticalPath(tasks);
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const inProgCount = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in-progress').length;
  const todoCount = tasks.length - doneCount - inProgCount;
  const totalDur = tasks.reduce((s, t) => s + durationDays(t), 0) || 1;
  const overallPct = tasks.length ? Math.round(tasks.reduce((s, t) => s + (Number(t.progress) || 0) * durationDays(t), 0) / totalDur) : 0;

  const COLS = [
    { label: '#', w: 10 },
    { label: 'Tâche', w: 56 },
    { label: 'Statut', w: 26, center: true },
    { label: 'Début', w: 22 },
    { label: 'Fin', w: 22 },
    { label: 'Durée', w: 16, center: true },
    { label: 'Préd.', w: 16, center: true },
    { label: '%', w: 14, center: true },
  ];
  const colX = [];
  { let x = marginL; for (const c of COLS) { colX.push(x); x += c.w; } }

  const drawBanner = () => banner(doc, pageW, marginL, marginR, title, groups ? 'Rapport des tâches par phase' : 'Rapport des tâches', [`Généré le ${new Date().toLocaleDateString('fr-FR')}`], 24);

  function summary(y) {
    const stats = [
      { label: 'Tâches', value: String(tasks.length) },
      { label: 'Terminées', value: String(doneCount), color: TONES.done.dark },
      { label: 'En cours', value: String(inProgCount), color: TONES.progress.dark },
      { label: 'À faire', value: String(todoCount) },
      { label: 'Avancement', value: `${overallPct}%`, color: PDF_GOLD },
      { label: 'Critiques', value: String(critical.size), color: critical.size ? PDF_CRITICAL : undefined },
    ];
    const boxW = contentW / stats.length;
    stats.forEach((s, i) => {
      const x = marginL + i * boxW;
      doc.setDrawColor(...PDF_GRID);
      doc.setFillColor(251, 249, 246);
      doc.roundedRect(x + 1, y, boxW - 2, 16, 1.6, 1.6, 'FD');
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...(s.color || PDF_INK));
      doc.text(s.value, x + boxW / 2, y + 7.5, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...PDF_MUTE);
      doc.text(s.label, x + boxW / 2, y + 12.4, { align: 'center' });
      doc.setTextColor(0);
    });
    return y + 21;
  }

  function statusPill(x, yBase, status) {
    const s = toneOf(status);
    doc.setFillColor(...s.dark);
    doc.roundedRect(x, yBase - 3.5, 20, 4.3, 1, 1, 'F');
    doc.setFontSize(6.3);
    doc.setTextColor(255, 255, 255);
    doc.text(s.label, x + 10, yBase - 0.5, { align: 'center' });
    doc.setTextColor(0);
  }

  function colHeader(y) {
    doc.setFillColor(243, 238, 229);
    doc.rect(marginL, y - 4.6, contentW, 6.2, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(90);
    COLS.forEach((c, i) => {
      if (c.center) doc.text(c.label, colX[i] + c.w / 2, y - 1, { align: 'center' });
      else doc.text(c.label, colX[i] + 2, y - 1);
    });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    doc.setDrawColor(...PDF_GRID);
    doc.line(marginL, y + 1.4, marginL + contentW, y + 1.4);
    return y + 6.6;
  }

  let y = 0;
  const newPage = (withHeader) => { doc.addPage('a4', 'portrait'); drawBanner(); y = 34; if (withHeader) y = colHeader(y); };

  drawBanner();
  y = summary(32) + 3;
  if (!tasks.length) {
    doc.setFontSize(11);
    doc.setTextColor(...PDF_MUTE);
    doc.text('Aucune tâche planifiée.', marginL, y + 6);
    doc.save(`taches-${fileBase(title)}.pdf`);
    return;
  }

  for (const s of sections(tasks, groups)) {
    if (y > pageH - marginB - 30) newPage(false);
    if (s.group) {
      const pDone = s.tasks.filter((t) => t.status === 'done').length;
      const pDur = s.tasks.reduce((a, t) => a + durationDays(t), 0) || 1;
      const pPct = s.tasks.length ? Math.round(s.tasks.reduce((a, t) => a + (Number(t.progress) || 0) * durationDays(t), 0) / pDur) : 0;
      doc.setFillColor(...PDF_BRAND_LIGHT);
      doc.rect(marginL, y, contentW, 8.4, 'F');
      doc.setDrawColor(...PDF_GOLD);
      doc.setLineWidth(1);
      doc.line(marginL, y, marginL, y + 8.4);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...PDF_INK);
      doc.text(truncate(doc, s.group.name, contentW * 0.55), marginL + 3, y + 5.6);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(...PDF_MUTE);
      doc.text(s.tasks.length ? `${pDone}/${s.tasks.length} terminées · ${pPct}% d’avancement` : 'Aucune tâche', marginL + contentW - 2, y + 5.6, { align: 'right' });
      doc.setTextColor(0);
      y += 12;
    }
    if (!s.tasks.length) { y += 3; continue; }

    y = colHeader(y);
    let zebra = 0;
    for (const t of s.tasks) {
      if (y > pageH - marginB - 3) { newPage(true); zebra = 0; }
      const isCritical = critical.has(t.id);
      const rowTop = y - 4.6;
      if (zebra % 2 === 1) { doc.setFillColor(251, 249, 246); doc.rect(marginL, rowTop, contentW, 6.6, 'F'); }
      if (isCritical) { doc.setFillColor(...PDF_CRITICAL); doc.rect(marginL, rowTop, 1.2, 6.6, 'F'); }
      zebra++;

      doc.setFontSize(7);
      doc.setTextColor(...PDF_MUTE);
      doc.text(num[t.id] || '', colX[0] + 2, y);
      doc.setFont(undefined, isCritical ? 'bold' : 'normal');
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : PDF_INK));
      doc.text(truncate(doc, (t.milestone ? '◆ ' : '') + t.name, COLS[1].w - 3), colX[1] + 2, y);
      doc.setFont(undefined, 'normal');
      statusPill(colX[2] + 3, y, t.status);
      doc.setTextColor(70, 64, 66);
      doc.text(t.startDate, colX[3] + 2, y);
      doc.text(t.endDate, colX[4] + 2, y);
      doc.text(`${durationDays(t)}j`, colX[5] + COLS[5].w / 2, y, { align: 'center' });
      const preds = (t.dependencies || []).map((d) => num[d]).filter(Boolean).join(',') || '—';
      doc.setTextColor(...PDF_MUTE);
      doc.text(truncate(doc, preds, COLS[6].w - 2), colX[6] + COLS[6].w / 2, y, { align: 'center' });
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : [70, 64, 66]));
      doc.text(`${t.progress ?? 0}%`, colX[7] + COLS[7].w / 2, y, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0);
      y += 6.6;
    }
    y += 5;
  }

  stampFooters(doc, title, marginL, marginR, pageW, pageH);
  doc.save(`taches-${fileBase(title)}-${todayKey()}.pdf`);
}
