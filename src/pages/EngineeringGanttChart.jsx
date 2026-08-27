import { useMemo, useState } from 'react';
import { Plus, Trash2, ZoomIn, ZoomOut, Diamond, AlertTriangle, FileDown } from 'lucide-react';
import { diffDays, addDaysKey, toDate, monthGroups, durationDays, computeCriticalPath, wouldCreateCycle } from '../utils/gantt';
import { todayKey } from '../utils/formatters';
import { Card, Button, Field, Input, Modal, EmptyState } from '../components/common/ui';

// Graphical PDF export — flat sibling of BusinessGanttChart's exportGanttPDF
// (no phase grouping, since engineering projects don't have Business's
// sub-phases). Same dynamic-import jsPDF pattern as every other export.
const PDF_ACCENT = [13, 148, 166];
const PDF_GRID = [225, 228, 231];
const PDF_MUTE = [123, 129, 135];
const PDF_STATUS = {
  todo: { fill: [150, 155, 161], dark: [96, 100, 105] },
  'in-progress': { fill: [219, 158, 42], dark: [163, 112, 20] },
  done: { fill: [36, 168, 113], dark: [20, 118, 78] },
};
const PDF_CRITICAL = [214, 62, 62];

function pdfDiamond(doc, cx, cy, r, color) {
  doc.setFillColor(...color);
  doc.triangle(cx, cy - r, cx + r, cy, cx, cy + r, 'F');
  doc.triangle(cx, cy - r, cx - r, cy, cx, cy + r, 'F');
}

async function exportGanttPDF(project, tasks) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14, marginR = 14, marginB = 16;
  const chartXmm = 80;
  const chartWidth = pageW - marginR - chartXmm;
  const fileBase = project.name.replace(/\s+/g, '-').toLowerCase();

  if (!tasks.length) {
    doc.setFontSize(11);
    doc.text(`${project.name} — aucune tâche planifiée.`, marginL, 20);
    doc.save(`gantt-${fileBase}.pdf`);
    return;
  }

  const min = [...tasks.map((t) => t.startDate)].sort()[0];
  const max = [...tasks.map((t) => t.endDate)].sort().slice(-1)[0];
  const totalDays = Math.max(1, diffDays(min, max) + 1);
  const dayW = chartWidth / totalDays;
  const xFor = (dateKey) => chartXmm + diffDays(min, dateKey) * dayW;
  const critical = computeCriticalPath(tasks);
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  function drawBanner() {
    doc.setFillColor(...PDF_ACCENT);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(15);
    doc.text(project.name, marginL, 13);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(`Diagramme de Gantt · ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} · ${doneCount} terminée${doneCount > 1 ? 's' : ''} · ${critical.size} critique${critical.size > 1 ? 's' : ''}`, marginL, 19);
    doc.setFontSize(7.5);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW - marginR, 12, { align: 'right' });
    doc.setTextColor(0);
  }

  function drawMonthRuler(y) {
    doc.setFillColor(246, 247, 248);
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
    doc.line(marginL, y + 1, pageW - marginR, y + 1);
  }

  drawBanner();
  drawMonthRuler(34);
  const chartTop = 40;
  const bodyBottom = pageH - marginB - 4;
  let y = chartTop;
  let page = 1;
  const layout = {};
  let zebra = 0;

  for (const t of tasks) {
    if (y > bodyBottom) { doc.addPage('a4', 'landscape'); page += 1; drawBanner(); drawMonthRuler(34); y = chartTop; }
    const isCritical = critical.has(t.id);
    if (zebra % 2 === 1) { doc.setFillColor(250, 250, 251); doc.rect(marginL, y - 4.6, pageW - marginL - marginR, 6.4, 'F'); }
    zebra++;

    doc.setFontSize(7.2);
    doc.setTextColor(...(isCritical ? PDF_CRITICAL : [28, 32, 36]));
    const label = doc.getTextWidth(t.title) > chartXmm - marginL - 6 ? `${t.title.slice(0, 28)}…` : t.title;
    doc.text(label, marginL + 2, y);
    doc.setFontSize(6.4);
    doc.setTextColor(...PDF_MUTE);
    doc.text(`${t.progress ?? 0}%`, chartXmm - 4, y, { align: 'right' });
    doc.setTextColor(0);

    const x1 = xFor(t.startDate);
    const w = Math.max(1.2, (diffDays(t.startDate, t.endDate) + 1) * dayW);
    const status = PDF_STATUS[t.status] || PDF_STATUS.todo;
    const fillColor = isCritical ? PDF_CRITICAL : status.fill;
    const darkColor = isCritical ? [150, 30, 30] : status.dark;
    if (t.milestone) {
      pdfDiamond(doc, x1 + 1, y - 1.8, 1.6, fillColor);
    } else {
      doc.setFillColor(...fillColor);
      doc.roundedRect(x1, y - 3.6, w, 3.4, 0.7, 0.7, 'F');
      const pct = t.progress ?? 0;
      if (pct > 0) {
        doc.setFillColor(...darkColor);
        const pw = Math.min(w, (w * pct) / 100);
        doc.rect(x1, y - 3.6, pw, 3.4, 'F');
      }
    }
    layout[t.id] = { x1, x2: t.milestone ? x1 + 1 : x1 + w, y: y - 1.9, page };
    y += 6.4;
  }

  for (const t of tasks) {
    const succ = layout[t.id];
    if (!succ) continue;
    for (const depId of t.dependencies || []) {
      const pred = layout[depId];
      if (!pred || pred.page !== succ.page) continue;
      doc.setPage(pred.page);
      const isCritical = critical.has(depId) && critical.has(t.id);
      const c = isCritical ? PDF_CRITICAL : [172, 176, 180];
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

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTE);
    doc.text(`Page ${p} / ${totalPages}`, pageW - marginR, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }

  doc.save(`gantt-${fileBase}-${todayKey()}.pdf`);
}

const STATUS_COLOR = { todo: 'var(--text-secondary)', 'in-progress': 'var(--warning)', done: 'var(--success)' };
const STATUS_LABEL = { todo: 'À faire', 'in-progress': 'En cours', done: 'Terminée' };

const COLS = { idx: 28, title: 200, start: 90, end: 90, dur: 54, pred: 60, pct: 46, del: 28 };
const chartX = Object.values(COLS).reduce((a, b) => a + b, 0);
const ROW_H = 32;
const HEADER_H = 30;

function Cell({ w, className = '', children }) {
  return <div style={{ width: w }} className={`shrink-0 flex items-center ${className}`}>{children}</div>;
}
function LegendItem({ swatch, children }) {
  return <span className="flex items-center gap-1.5 text-[11px] text-mute whitespace-nowrap">{swatch}{children}</span>;
}
function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 bg-surface border border-line rounded-lg px-2.5 py-1">
      <span className="text-sm font-bold" style={color ? { color } : undefined}>{value}</span>
      <span className="text-[10px] text-mute">{label}</span>
    </div>
  );
}

const blankTaskForm = () => ({ title: '', startDate: todayKey(), endDate: todayKey(), milestone: false, progress: 0, dependencies: [] });

// Simplified sibling of BusinessGanttChart.jsx (pages/BusinessGanttChart.jsx),
// added 2026-08-27 — same scheduling engine (utils/gantt.js: cascadeSchedule,
// computeCriticalPath), same drag/zoom/critical-path interaction model, but
// flat (no phase grouping — engineering projects don't have Business's
// sub-phases, just ENGINEERING_PROJECT_STAGES on the task itself) and without
// the drag-to-link connector or PDF export (kept deliberately lighter-weight;
// dependencies are set from the edit modal's checklist instead).
export default function EngineeringGanttChart({ project, updateTask, deleteTask }) {
  const [dayWidth, setDayWidth] = useState(24);
  const [preview, setPreview] = useState(null); // { taskId, startDate, endDate }
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(blankTaskForm());

  const tasks = useMemo(() => [...(project.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [project.tasks]);
  const critical = useMemo(() => computeCriticalPath(tasks), [tasks]);
  const idxById = useMemo(() => Object.fromEntries(tasks.map((t, i) => [t.id, i + 1])), [tasks]);

  const range = useMemo(() => {
    if (!tasks.length) return null;
    const starts = [...tasks.map((t) => t.startDate)].sort();
    const ends = [...tasks.map((t) => t.endDate)].sort();
    const min = addDaysKey(starts[0], -2);
    const max = addDaysKey(ends[ends.length - 1], 3);
    return { min, max, totalDays: diffDays(min, max) + 1 };
  }, [tasks]);

  const openEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({ title: t.title, startDate: t.startDate, endDate: t.endDate, milestone: !!t.milestone, progress: t.progress ?? 0, dependencies: t.dependencies || [] });
    setTaskModal(true);
  };
  const submitTask = (e) => {
    e.preventDefault();
    if (!editingTask || !taskForm.title.trim()) return;
    updateTask(project.id, editingTask.id, taskForm);
    setTaskModal(false);
  };

  const effective = (task) => (preview && preview.taskId === task.id ? { ...task, ...preview } : task);

  const startDrag = (e, task, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const orig = { startDate: task.startDate, endDate: task.endDate };
    let moved = false;
    let current = orig;
    const onMove = (ev) => {
      const deltaDays = Math.round((ev.clientX - startX) / dayWidth);
      if (deltaDays !== 0) moved = true;
      let ns = orig.startDate, ne = orig.endDate;
      if (mode === 'move') { ns = addDaysKey(orig.startDate, deltaDays); ne = addDaysKey(orig.endDate, deltaDays); }
      else if (mode === 'resize-start') { ns = addDaysKey(orig.startDate, deltaDays); if (ns > orig.endDate) ns = orig.endDate; }
      else if (mode === 'resize-end') { ne = addDaysKey(orig.endDate, deltaDays); if (ne < orig.startDate) ne = orig.startDate; }
      current = { startDate: ns, endDate: ne };
      setPreview({ taskId: task.id, ...current });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setPreview(null);
      if (moved) updateTask(project.id, task.id, current);
      else openEditTask(task);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!tasks.length) {
    return <Card title="Gantt"><EmptyState>Ajoutez des tâches (bouton ci-dessus) pour voir apparaître le planning.</EmptyState></Card>;
  }

  const timelineW = range ? range.totalDays * dayWidth : 0;
  const today = todayKey();
  const showToday = range && today >= range.min && today <= range.max;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in-progress').length;

  const geom = {};
  if (range) {
    tasks.forEach((t, i) => {
      const eff = effective(t);
      const x1 = diffDays(range.min, eff.startDate) * dayWidth;
      const x2 = (diffDays(range.min, eff.endDate) + 1) * dayWidth;
      geom[t.id] = { x1, x2, yCenter: i * ROW_H + ROW_H / 2 };
    });
  }

  const arrows = [];
  tasks.forEach((t) => {
    for (const depId of t.dependencies || []) {
      const pred = geom[depId];
      const succ = geom[t.id];
      if (!pred || !succ) continue;
      arrows.push({ key: `${depId}-${t.id}`, pred, succ, criticalLink: critical.has(depId) && critical.has(t.id) });
    }
  });

  const weekendCols = [];
  if (range) {
    for (let i = 0; i < range.totalDays; i++) {
      const dow = toDate(addDaysKey(range.min, i)).getDay();
      if (dow === 0 || dow === 6) weekendCols.push(i * dayWidth);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center border border-line rounded-lg overflow-hidden">
            <button className="text-mute hover:text-ink hover:bg-surface p-1.5 cursor-pointer" title="Zoom arrière" onClick={() => setDayWidth((w) => Math.max(10, w - 4))}><ZoomOut size={14} /></button>
            <div className="w-px h-4 bg-line" />
            <button className="text-mute hover:text-ink hover:bg-surface p-1.5 cursor-pointer" title="Zoom avant" onClick={() => setDayWidth((w) => Math.min(44, w + 4))}><ZoomIn size={14} /></button>
          </div>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportGanttPDF(project, tasks)}><span className="flex items-center gap-2"><FileDown size={13} /> Gantt (PDF)</span></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="tâches" value={tasks.length} />
          <StatPill label="terminées" value={doneCount} color="var(--success)" />
          <StatPill label="en cours" value={inProgressCount} color="var(--warning)" />
          <StatPill label="chemin critique" value={critical.size} color={critical.size ? 'var(--error)' : undefined} />
        </div>
      </div>

      <Card title={`Gantt · ${tasks.length} tâche${tasks.length > 1 ? 's' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] -mt-1 mb-3 pb-3 border-b border-line">
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <LegendItem key={v} swatch={<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[v] }} />}>{label}</LegendItem>
          ))}
          <LegendItem swatch={<span className="inline-block w-2.5 h-2.5 rounded-sm border-2 shrink-0" style={{ borderColor: 'var(--error)' }} />}>Chemin critique</LegendItem>
          <LegendItem swatch={<Diamond size={11} className="shrink-0" />}>Jalon</LegendItem>
          <span className="text-[11px] text-mute">Clique une barre pour l'éditer (dates, dépendances, avancement) · glisse pour déplacer/redimensionner.</span>
        </div>

        <div className="overflow-x-auto border border-line rounded-lg shadow-sm">
          <div className="relative" style={{ width: chartX + timelineW }}>
            <div className="absolute pointer-events-none" style={{ left: chartX, top: HEADER_H, width: timelineW, height: tasks.length * ROW_H }}>
              {weekendCols.map((wx, i) => (
                <div key={i} className="absolute top-0 bottom-0" style={{ left: wx, width: dayWidth, background: 'var(--text-secondary)', opacity: 0.055 }} />
              ))}
            </div>

            <div className="flex sticky top-0 z-20 bg-surface border-b border-line shadow-sm" style={{ height: HEADER_H }}>
              <div className="sticky left-0 z-30 bg-surface flex items-center shrink-0 text-[9px] text-mute font-bold uppercase tracking-wide border-r border-line divide-x divide-line/50" style={{ width: chartX }}>
                <Cell w={COLS.idx} className="justify-center">#</Cell>
                <Cell w={COLS.title} className="px-2">Tâche</Cell>
                <Cell w={COLS.start} className="px-2">Début</Cell>
                <Cell w={COLS.end} className="px-2">Fin</Cell>
                <Cell w={COLS.dur} className="justify-center">Durée</Cell>
                <Cell w={COLS.pred} className="justify-center">Préd.</Cell>
                <Cell w={COLS.pct} className="justify-center">%</Cell>
                <Cell w={COLS.del} />
              </div>
              <div className="flex">
                {monthGroups(range.min, range.max).map((g, i) => (
                  <div key={i} className="text-[10px] text-mute font-semibold text-center border-l border-line py-1.5 truncate flex items-end justify-center uppercase tracking-wide" style={{ width: g.days * dayWidth }}>{g.label}</div>
                ))}
              </div>
            </div>

            {tasks.map((task, ri) => {
              const eff = effective(task);
              const isCritical = critical.has(task.id);
              const color = STATUS_COLOR[task.status] || STATUS_COLOR.todo;
              const dur = durationDays(eff);
              const g = geom[task.id];
              const rowBg = ri % 2 === 1 ? 'var(--bg-tertiary)' : 'color-mix(in srgb, var(--text-secondary) 4%, var(--bg-tertiary))';
              return (
                <div key={task.id} className="flex items-center border-b border-line/30 group hover:brightness-[1.03] transition-[filter]" style={{ height: ROW_H }}>
                  <div className="sticky left-0 z-10 flex items-center shrink-0 text-xs border-r border-line divide-x divide-line/30" style={{ width: chartX, background: rowBg }}>
                    <Cell w={COLS.idx} className="justify-center text-[10px] text-mute font-mono">{idxById[task.id]}</Cell>
                    <Cell w={COLS.title} className="px-1.5 gap-1 truncate cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      {task.milestone && <Diamond size={10} className="shrink-0 text-mute" />}
                      <span className="truncate hover:underline hover:text-accent" title={task.title} onClick={() => openEditTask(task)}>{task.title}</span>
                      {isCritical && <AlertTriangle size={10} className="shrink-0 ml-auto" style={{ color: 'var(--error)' }} />}
                    </Cell>
                    <Cell w={COLS.start} className="px-1.5">
                      <input type="date" value={task.startDate} onChange={(e) => updateTask(project.id, task.id, { startDate: e.target.value })} className="w-full bg-transparent text-[10px] font-mono text-mute focus:outline-none focus:text-ink cursor-pointer" />
                    </Cell>
                    <Cell w={COLS.end} className="px-1.5">
                      <input type="date" value={task.endDate} disabled={task.milestone} onChange={(e) => updateTask(project.id, task.id, { endDate: e.target.value })} className="w-full bg-transparent text-[10px] font-mono text-mute focus:outline-none focus:text-ink cursor-pointer disabled:opacity-40" />
                    </Cell>
                    <Cell w={COLS.dur} className="justify-center">
                      <input type="number" min="1" value={dur} disabled={task.milestone} onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 1); updateTask(project.id, task.id, { endDate: addDaysKey(task.startDate, n - 1) }); }} className="w-9 bg-transparent text-[10px] text-mute text-center focus:outline-none focus:text-ink disabled:opacity-40" />
                    </Cell>
                    <Cell w={COLS.pred} className="justify-center text-[9px] text-mute truncate font-mono" title={(task.dependencies || []).map((d) => idxById[d]).filter(Boolean).join(', ')}>
                      {(task.dependencies || []).map((d) => idxById[d]).filter(Boolean).join(',') || '—'}
                    </Cell>
                    <Cell w={COLS.pct} className="justify-center">
                      <input type="number" min="0" max="100" step="5" value={task.progress ?? 0} onChange={(e) => updateTask(project.id, task.id, { progress: e.target.value })} className="w-8 bg-transparent text-[10px] font-semibold text-mute text-center focus:outline-none focus:text-ink" />
                    </Cell>
                    <Cell w={COLS.del} className="justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer la tâche "${task.title}" ?`)) deleteTask(project.id, task.id); }}><Trash2 size={12} /></button>
                    </Cell>
                  </div>
                  <div className="relative h-full" style={{ width: timelineW, background: rowBg }}>
                    {task.milestone ? (
                      <div
                        className="absolute top-1/2 rotate-45 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                        style={{ left: g.x1 + dayWidth / 2 - 6, marginTop: -6, width: 12, height: 12, borderRadius: 2, background: color, border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 60%, black)` }}
                        onPointerDown={(e) => startDrag(e, task, 'move')}
                        title={`◆ ${task.title} · ${task.startDate}`}
                      />
                    ) : (
                      <div
                        className="absolute top-2 bottom-2 rounded-md flex items-center px-1.5 cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          left: g.x1,
                          width: Math.max(dayWidth * 0.6, g.x2 - g.x1 - 2),
                          background: `linear-gradient(180deg, color-mix(in srgb, ${color} 26%, var(--bg-tertiary)), color-mix(in srgb, ${color} 16%, var(--bg-tertiary)))`,
                          border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
                        }}
                        onPointerDown={(e) => startDrag(e, task, 'move')}
                        title={`${task.startDate} → ${task.endDate} · ${task.progress ?? 0}%${isCritical ? ' · critique' : ''}`}
                      >
                        <div className="absolute inset-y-0 left-0 rounded-l-md pointer-events-none" style={{ width: `${task.progress ?? 0}%`, background: `color-mix(in srgb, ${color} 60%, transparent)` }} />
                        <span className="relative text-[10px] font-semibold truncate z-10" style={{ color: `color-mix(in srgb, ${color} 80%, black)` }}>{task.title}</span>
                        <span onPointerDown={(e) => startDrag(e, task, 'resize-start')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                        <span onPointerDown={(e) => startDrag(e, task, 'resize-end')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <svg className="absolute pointer-events-none" style={{ left: chartX, top: HEADER_H, width: timelineW, height: tasks.length * ROW_H }}>
              <defs>
                <marker id="eng-gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-secondary)" />
                </marker>
                <marker id="eng-gantt-arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--error)" />
                </marker>
              </defs>
              {arrows.map((a) => {
                const midX = a.pred.x2 + 8;
                const d = `M ${a.pred.x2} ${a.pred.yCenter} L ${midX} ${a.pred.yCenter} L ${midX} ${a.succ.yCenter} L ${a.succ.x1 - 2} ${a.succ.yCenter}`;
                return (
                  <path key={a.key} d={d} fill="none" stroke={a.criticalLink ? 'var(--error)' : 'var(--text-secondary)'} strokeWidth={a.criticalLink ? 1.6 : 1.1} strokeLinejoin="round" opacity={a.criticalLink ? 0.95 : 0.5} markerEnd={`url(#${a.criticalLink ? 'eng-gantt-arrow-critical' : 'eng-gantt-arrow'})`} />
                );
              })}
            </svg>

            {showToday && (
              <div className="absolute z-10 pointer-events-none" style={{ left: chartX + diffDays(range.min, today) * dayWidth, top: HEADER_H, bottom: 0 }}>
                <div className="absolute top-0 h-full border-l-2 border-dashed" style={{ borderColor: 'var(--accent-primary)' }} />
                <div className="absolute top-0 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-b" style={{ background: 'var(--accent-primary)', color: 'var(--bg-tertiary)' }}>Auj.</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Planifier la tâche">
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Titre">
            <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label=" ">
              <label className="flex items-center gap-2 text-xs h-full pb-1.5">
                <input type="checkbox" checked={taskForm.milestone} onChange={(e) => setTaskForm({ ...taskForm, milestone: e.target.checked, endDate: e.target.checked ? taskForm.startDate : taskForm.endDate })} />
                <span className="flex items-center gap-1"><Diamond size={12} /> Jalon (durée 0)</span>
              </label>
            </Field>
            <Field label={`Avancement — ${taskForm.progress}%`}>
              <input type="range" min="0" max="100" step="5" value={taskForm.progress} onChange={(e) => setTaskForm({ ...taskForm, progress: Number(e.target.value) })} className="w-full accent-[var(--accent-primary)] mt-2.5" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début">
              <Input type="date" value={taskForm.startDate} onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value, endDate: taskForm.milestone ? e.target.value : taskForm.endDate })} />
            </Field>
            <Field label="Fin">
              <Input type="date" value={taskForm.endDate} min={taskForm.startDate} disabled={taskForm.milestone} onChange={(e) => setTaskForm({ ...taskForm, endDate: e.target.value })} />
            </Field>
            <Field label="Durée (j)">
              <Input type="number" min="1" disabled={taskForm.milestone} value={taskForm.milestone ? 0 : diffDays(taskForm.startDate, taskForm.endDate) + 1}
                onChange={(e) => setTaskForm({ ...taskForm, endDate: addDaysKey(taskForm.startDate, Math.max(1, Number(e.target.value) || 1) - 1) })} />
            </Field>
          </div>
          <Field label="Prédécesseurs (fin → début)" hint="La tâche ne pourra pas commencer avant la fin de ses prédécesseurs — le planning se recale automatiquement.">
            <div className="max-h-36 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {tasks.filter((t) => t.id !== editingTask?.id).length === 0 ? (
                <div className="text-xs text-mute px-3 py-2">Aucune autre tâche.</div>
              ) : tasks.filter((t) => t.id !== editingTask?.id).map((t) => {
                const disabled = editingTask ? wouldCreateCycle(tasks, t.id, editingTask.id) : false;
                const checked = taskForm.dependencies.includes(t.id);
                return (
                  <label key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => setTaskForm({ ...taskForm, dependencies: e.target.checked ? [...taskForm.dependencies, t.id] : taskForm.dependencies.filter((d) => d !== t.id) })}
                    />
                    <span className="text-mute w-6 shrink-0">{idxById[t.id]}</span>
                    <span className="truncate">{t.title}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
