import { useMemo, useState } from 'react';
import { Plus, Trash2, FileDown, FileText, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Link2, Diamond, AlertTriangle } from 'lucide-react';
import { diffDays, addDaysKey, toDate, monthGroups, durationDays, computeCriticalPath, wouldCreateCycle } from '../../utils/gantt';
import { todayKey } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Card, Button, Field, Input, Select, Modal, EmptyState } from '../../components/common/ui';

export const TASK_STATUS = [
  { value: 'todo', label: 'À faire', color: 'var(--text-secondary)' },
  { value: 'in_progress', label: 'En cours', color: 'var(--warning)' },
  { value: 'done', label: 'Terminée', color: 'var(--success)' },
];

const COLS = { wbs: 34, name: 180, start: 90, end: 90, dur: 54, pred: 66, pct: 46, del: 28 };
const chartX = Object.values(COLS).reduce((a, b) => a + b, 0);
const ROW_H = 32;
const HEADER_H = 30;

const blankTask = (phaseId) => ({ phaseId: phaseId || '', name: '', startDate: todayKey(), endDate: todayKey(), milestone: false, progress: 0, status: 'todo', dependencies: [] });

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

// Diagramme de Gantt planifié : dépendances entre tâches (fin→début),
// replanification en cascade quand un prédécesseur bouge, chemin critique
// (CPM), jalons, phases en lignes de synthèse repliables — pas juste des
// barres colorées. Table + barres partagent le même ordre de lignes (`rows`)
// pour que les flèches de dépendance pointent au bon endroit.
export default function GanttTab({ business, store }) {
  const [dayWidth, setDayWidth] = useState(24);
  const [collapsed, setCollapsed] = useState({});
  const [preview, setPreview] = useState(null); // { taskId, startDate, endDate }
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(blankTask(business.phases[0]?.id));

  const allTasks = business.tasks || [];
  const phases = [...business.phases].sort((a, b) => a.order - b.order);

  const tasksByPhase = useMemo(() => {
    const m = {};
    for (const t of allTasks) (m[t.phaseId] ??= []).push(t);
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return m;
  }, [allTasks]);

  const wbsById = useMemo(() => {
    const map = {};
    phases.forEach((phase, pi) => (tasksByPhase[phase.id] || []).forEach((t, ti) => { map[t.id] = `${pi + 1}.${ti + 1}`; }));
    return map;
  }, [phases, tasksByPhase]);

  const rows = useMemo(() => {
    const out = [];
    phases.forEach((phase, pi) => {
      const pTasks = tasksByPhase[phase.id] || [];
      out.push({ type: 'phase', phase, wbs: String(pi + 1), tasks: pTasks });
      if (!collapsed[phase.id]) pTasks.forEach((t) => out.push({ type: 'task', task: t, wbs: wbsById[t.id] }));
    });
    return out;
  }, [phases, tasksByPhase, collapsed, wbsById]);

  const critical = useMemo(() => computeCriticalPath(allTasks), [allTasks]);

  const range = useMemo(() => {
    if (!allTasks.length) return null;
    const starts = [...allTasks.map((t) => t.startDate)].sort();
    const ends = [...allTasks.map((t) => t.endDate)].sort();
    const min = addDaysKey(starts[0], -2);
    const max = addDaysKey(ends[ends.length - 1], 3);
    return { min, max, totalDays: diffDays(min, max) + 1 };
  }, [allTasks]);

  const openAddTask = (phaseId) => { setEditingTask(null); setTaskForm(blankTask(phaseId || business.phases[0]?.id)); setTaskModal(true); };
  const openEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({ phaseId: t.phaseId, name: t.name, startDate: t.startDate, endDate: t.endDate, milestone: !!t.milestone, progress: t.progress, status: t.status, dependencies: t.dependencies || [] });
    setTaskModal(true);
  };
  const submitTask = (e) => {
    e.preventDefault();
    if (!taskForm.name.trim() || !taskForm.phaseId) return;
    const res = editingTask ? store.editTask(business.id, editingTask.id, taskForm) : store.addTask(business.id, taskForm);
    if (res && res.ok === false) return alert(res.error);
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
      if (moved) store.editTask(business.id, task.id, current);
      else openEditTask(task);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startLink = (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    let dropped = false;
    const onUp = (ev) => {
      window.removeEventListener('pointerup', onUp);
      const targetEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-task-id]');
      const targetId = targetEl?.getAttribute('data-task-id');
      dropped = true;
      if (!targetId || targetId === task.id) return;
      const target = allTasks.find((t) => t.id === targetId);
      if (!target) return;
      if ((target.dependencies || []).includes(task.id)) { toast('Dépendance déjà présente.', 'info'); return; }
      if (wouldCreateCycle(allTasks, task.id, targetId)) { toast('Impossible : cela créerait une dépendance circulaire.', 'error'); return; }
      store.editTask(business.id, targetId, { dependencies: [...(target.dependencies || []), task.id] });
      toast(`Dépendance créée : ${wbsById[task.id]} → ${wbsById[targetId]}`, 'success');
    };
    window.addEventListener('pointerup', onUp);
    setTimeout(() => { if (!dropped) window.removeEventListener('pointerup', onUp); }, 8000);
  };

  if (!business.phases.length) {
    return <Card title="Gantt"><EmptyState>Créez d'abord une ou plusieurs phases (onglet Phases) — chaque tâche du Gantt appartient à une phase.</EmptyState></Card>;
  }

  const timelineW = range ? range.totalDays * dayWidth : 0;
  const today = todayKey();
  const showToday = range && today >= range.min && today <= range.max;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const inProgressCount = allTasks.filter((t) => t.status === 'in_progress').length;

  // Géométrie des barres (coordonnées locales à la zone timeline, sans le
  // décalage chartX) — partagée par le rendu des barres et par les flèches
  // de dépendance, calculée une fois par rendu à partir de `rows`.
  const geom = {};
  if (range) {
    rows.forEach((row, ri) => {
      if (row.type !== 'task') return;
      const eff = effective(row.task);
      const x1 = diffDays(range.min, eff.startDate) * dayWidth;
      const x2 = (diffDays(range.min, eff.endDate) + 1) * dayWidth;
      geom[row.task.id] = { x1, x2, yCenter: ri * ROW_H + ROW_H / 2, milestone: row.task.milestone };
    });
  }

  const arrows = [];
  rows.forEach((row) => {
    if (row.type !== 'task') return;
    for (const depId of row.task.dependencies || []) {
      const pred = geom[depId];
      const succ = geom[row.task.id];
      if (!pred || !succ) continue; // predecessor's phase is collapsed, or missing
      arrows.push({ key: `${depId}-${row.task.id}`, pred, succ, criticalLink: critical.has(depId) && critical.has(row.task.id) });
    }
  });

  // Bandes week-end (samedi/dimanche) affichées en arrière-plan du planning —
  // repère visuel standard des outils de gestion de projet professionnels.
  const weekendCols = [];
  if (range) {
    for (let i = 0; i < range.totalDays; i++) {
      const dow = toDate(addDaysKey(range.min, i)).getDay();
      if (dow === 0 || dow === 6) weekendCols.push(i * dayWidth);
    }
  }

  // Bandes zébrées sur les lignes de tâches uniquement (pas les synthèses de
  // phase), indexées indépendamment des sauts de phase pour rester lisibles.
  let zebraCounter = -1;
  const zebraByRowIndex = rows.map((r) => (r.type === 'task' ? ++zebraCounter % 2 : null));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAddTask()}><span className="flex items-center gap-2"><Plus size={13} /> Tâche</span></Button>
          <div className="flex items-center border border-line rounded-lg overflow-hidden ml-1">
            <button className="text-mute hover:text-ink hover:bg-surface p-1.5 cursor-pointer" title="Zoom arrière" onClick={() => setDayWidth((w) => Math.max(10, w - 4))}><ZoomOut size={14} /></button>
            <div className="w-px h-4 bg-line" />
            <button className="text-mute hover:text-ink hover:bg-surface p-1.5 cursor-pointer" title="Zoom avant" onClick={() => setDayWidth((w) => Math.min(44, w + 4))}><ZoomIn size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportGanttPDF(business)}><span className="flex items-center gap-2"><FileDown size={13} /> Gantt (PDF)</span></Button>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportTasksReportPDF(business)}><span className="flex items-center gap-2"><FileText size={13} /> Tâches par phase (PDF)</span></Button>
        </div>
      </div>

      {!!allTasks.length && (
        <div className="flex flex-wrap gap-2">
          <StatPill label="tâches" value={allTasks.length} />
          <StatPill label="terminées" value={doneCount} color="var(--success)" />
          <StatPill label="en cours" value={inProgressCount} color="var(--warning)" />
          <StatPill label="chemin critique" value={critical.size} color={critical.size ? 'var(--error)' : undefined} />
        </div>
      )}

      <Card title={`Gantt · ${allTasks.length} tâche${allTasks.length > 1 ? 's' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] -mt-1 mb-3 pb-3 border-b border-line">
          {TASK_STATUS.map((s) => (
            <LegendItem key={s.value} swatch={<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />}>{s.label}</LegendItem>
          ))}
          <LegendItem swatch={<span className="inline-block w-2.5 h-2.5 rounded-sm border-2 shrink-0" style={{ borderColor: 'var(--error)' }} />}>Chemin critique</LegendItem>
          <LegendItem swatch={<Diamond size={11} className="shrink-0" />}>Jalon</LegendItem>
          <LegendItem swatch={<Link2 size={11} className="shrink-0" />}>Glisser le rond pour lier deux tâches</LegendItem>
        </div>

        {!allTasks.length ? (
          <EmptyState>Aucune tâche. Ajoutez la première tâche d'une phase pour voir apparaître le Gantt.</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-line rounded-lg shadow-sm">
            <div className="relative" style={{ width: chartX + timelineW }}>
              {/* Bandes week-end (sous tout le reste) */}
              <div className="absolute pointer-events-none" style={{ left: chartX, top: HEADER_H, width: timelineW, height: rows.length * ROW_H }}>
                {weekendCols.map((wx, i) => (
                  <div key={i} className="absolute top-0 bottom-0" style={{ left: wx, width: dayWidth, background: 'var(--text-secondary)', opacity: 0.055 }} />
                ))}
              </div>

              {/* En-tête */}
              <div className="flex sticky top-0 z-20 bg-surface border-b border-line shadow-sm" style={{ height: HEADER_H }}>
                <div className="sticky left-0 z-30 bg-surface flex items-center shrink-0 text-[9px] text-mute font-bold uppercase tracking-wide border-r border-line divide-x divide-line/50" style={{ width: chartX }}>
                  <Cell w={COLS.wbs} className="justify-center">#</Cell>
                  <Cell w={COLS.name} className="px-2">Tâche</Cell>
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

              {/* Lignes */}
              {rows.map((row, ri) => {
                if (row.type === 'phase') {
                  const pTasks = row.tasks;
                  const rMin = pTasks.length ? [...pTasks.map((t) => t.startDate)].sort()[0] : null;
                  const rMax = pTasks.length ? [...pTasks.map((t) => t.endDate)].sort().slice(-1)[0] : null;
                  const avgPct = pTasks.length ? Math.round(pTasks.reduce((s, t) => s + t.progress * durationDays(t), 0) / pTasks.reduce((s, t) => s + durationDays(t), 0)) : null;
                  const isCollapsed = !!collapsed[row.phase.id];
                  const barX1 = rMin ? diffDays(range.min, rMin) * dayWidth : null;
                  const barX2 = rMax ? (diffDays(range.min, rMax) + 1) * dayWidth : null;
                  return (
                    <div key={row.phase.id} className="flex items-center border-b border-line" style={{ height: ROW_H, background: 'color-mix(in srgb, var(--accent-primary) 7%, var(--bg-tertiary))' }}>
                      <div className="sticky left-0 z-10 flex items-center shrink-0 text-xs border-r border-line divide-x divide-line/40" style={{ width: chartX, background: 'color-mix(in srgb, var(--accent-primary) 9%, var(--bg-tertiary))' }}>
                        <Cell w={COLS.wbs} className="justify-center font-bold text-[10px] text-mute">{row.wbs}</Cell>
                        <Cell w={COLS.name} className="px-1.5 gap-1 font-bold truncate">
                          <button onClick={() => setCollapsed((c) => ({ ...c, [row.phase.id]: !c[row.phase.id] }))} className="text-mute hover:text-accent cursor-pointer shrink-0">
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <span className="truncate" title={row.phase.name}>{row.phase.name}</span>
                          <span className="text-[9px] font-normal text-mute shrink-0">({pTasks.length})</span>
                        </Cell>
                        <Cell w={COLS.start} className="px-2 text-[10px] text-mute font-mono">{rMin || '—'}</Cell>
                        <Cell w={COLS.end} className="px-2 text-[10px] text-mute font-mono">{rMax || '—'}</Cell>
                        <Cell w={COLS.dur} className="justify-center text-[10px] text-mute">{rMin && rMax ? `${diffDays(rMin, rMax) + 1}j` : '—'}</Cell>
                        <Cell w={COLS.pred} />
                        <Cell w={COLS.pct} className="justify-center text-[10px] font-semibold">{avgPct != null ? `${avgPct}%` : '—'}</Cell>
                        <Cell w={COLS.del} className="justify-center">
                          <button className="text-mute hover:text-accent cursor-pointer" title="Ajouter une tâche à cette phase" onClick={() => openAddTask(row.phase.id)}><Plus size={13} /></button>
                        </Cell>
                      </div>
                      <div className="relative h-full" style={{ width: timelineW }}>
                        {barX1 != null && (
                          <div className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-sm shadow-sm" style={{ left: barX1, width: Math.max(2, barX2 - barX1 - 2), background: 'var(--text-secondary)' }}>
                            <div className="absolute inset-y-0 left-0 rounded-l-sm" style={{ width: `${avgPct ?? 0}%`, background: 'var(--accent-primary)' }} />
                            <div className="absolute -top-1 left-0 w-1.5 h-4.5 rounded-sm" style={{ background: 'var(--text-secondary)' }} />
                            <div className="absolute -top-1 right-0 w-1.5 h-4.5 rounded-sm" style={{ background: 'var(--text-secondary)' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const task = row.task;
                const eff = effective(task);
                const isCritical = critical.has(task.id);
                const color = TASK_STATUS.find((s) => s.value === task.status)?.color;
                const dur = durationDays(eff);
                const g = geom[task.id];
                const zebra = zebraByRowIndex[ri];
                const rowBg = zebra === 1 ? 'var(--bg-tertiary)' : 'color-mix(in srgb, var(--text-secondary) 4%, var(--bg-tertiary))';
                return (
                  <div key={task.id} className="flex items-center border-b border-line/30 group hover:brightness-[1.03] transition-[filter]" style={{ height: ROW_H }}>
                    <div className="sticky left-0 z-10 flex items-center shrink-0 text-xs border-r border-line divide-x divide-line/30" style={{ width: chartX, background: rowBg }}>
                      <Cell w={COLS.wbs} className="justify-center text-[10px] text-mute font-mono">{row.wbs}</Cell>
                      <Cell w={COLS.name} className="px-1.5 gap-1 truncate cursor-pointer">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        {task.milestone && <Diamond size={10} className="shrink-0 text-mute" />}
                        <span className="truncate hover:underline hover:text-accent" title={task.name} onClick={() => openEditTask(task)}>{task.name}</span>
                        {isCritical && <AlertTriangle size={10} className="shrink-0 ml-auto" style={{ color: 'var(--error)' }} />}
                      </Cell>
                      <Cell w={COLS.start} className="px-1.5">
                        <input type="date" value={task.startDate} onChange={(e) => store.editTask(business.id, task.id, { startDate: e.target.value })} className="w-full bg-transparent text-[10px] font-mono text-mute focus:outline-none focus:text-ink cursor-pointer" />
                      </Cell>
                      <Cell w={COLS.end} className="px-1.5">
                        <input type="date" value={task.endDate} disabled={task.milestone} onChange={(e) => store.editTask(business.id, task.id, { endDate: e.target.value })} className="w-full bg-transparent text-[10px] font-mono text-mute focus:outline-none focus:text-ink cursor-pointer disabled:opacity-40" />
                      </Cell>
                      <Cell w={COLS.dur} className="justify-center">
                        <input type="number" min="1" value={dur} disabled={task.milestone} onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 1); store.editTask(business.id, task.id, { endDate: addDaysKey(task.startDate, n - 1) }); }} className="w-9 bg-transparent text-[10px] text-mute text-center focus:outline-none focus:text-ink disabled:opacity-40" />
                      </Cell>
                      <Cell w={COLS.pred} className="justify-center text-[9px] text-mute truncate font-mono" title={(task.dependencies || []).map((d) => wbsById[d]).filter(Boolean).join(', ')}>
                        {(task.dependencies || []).map((d) => wbsById[d]).filter(Boolean).join(',') || '—'}
                      </Cell>
                      <Cell w={COLS.pct} className="justify-center">
                        <input type="number" min="0" max="100" step="5" value={task.progress} onChange={(e) => store.editTask(business.id, task.id, { progress: e.target.value })} className="w-8 bg-transparent text-[10px] font-semibold text-mute text-center focus:outline-none focus:text-ink" />
                      </Cell>
                      <Cell w={COLS.del} className="justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer la tâche "${task.name}" ?`)) store.deleteTask(business.id, task.id); }}><Trash2 size={12} /></button>
                      </Cell>
                    </div>
                    <div className="relative h-full" style={{ width: timelineW, background: rowBg }}>
                      {task.milestone ? (
                        <div
                          data-task-id={task.id}
                          className="absolute top-1/2 rotate-45 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                          style={{ left: g.x1 + dayWidth / 2 - 6, marginTop: -6, width: 12, height: 12, borderRadius: 2, background: color, border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 60%, black)` }}
                          onPointerDown={(e) => startDrag(e, task, 'move')}
                          title={`◆ ${task.name} · ${task.startDate}`}
                        />
                      ) : (
                        <div
                          data-task-id={task.id}
                          className="absolute top-2 bottom-2 rounded-md flex items-center px-1.5 cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow"
                          style={{
                            left: g.x1,
                            width: Math.max(dayWidth * 0.6, g.x2 - g.x1 - 2),
                            background: `linear-gradient(180deg, color-mix(in srgb, ${color} 26%, var(--bg-tertiary)), color-mix(in srgb, ${color} 16%, var(--bg-tertiary)))`,
                            border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
                          }}
                          onPointerDown={(e) => startDrag(e, task, 'move')}
                          title={`${task.startDate} → ${task.endDate} · ${task.progress}%${isCritical ? ' · critique' : ''}`}
                        >
                          <div className="absolute inset-y-0 left-0 rounded-l-md pointer-events-none" style={{ width: `${task.progress}%`, background: `color-mix(in srgb, ${color} 60%, transparent)` }} />
                          <span className="relative text-[10px] font-semibold truncate z-10" style={{ color: `color-mix(in srgb, ${color} 80%, black)` }}>{task.name}</span>
                          <span onPointerDown={(e) => startDrag(e, task, 'resize-start')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                          <span onPointerDown={(e) => startDrag(e, task, 'resize-end')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                        </div>
                      )}
                      <div
                        onPointerDown={(e) => startLink(e, task)}
                        title="Glisser vers une autre tâche pour créer une dépendance"
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full cursor-crosshair border-2 border-card z-10 opacity-0 group-hover:opacity-100 hover:scale-125 transition-all shadow"
                        style={{ left: g.x2 - 3, background: color }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Flèches de dépendance */}
              <svg className="absolute pointer-events-none" style={{ left: chartX, top: HEADER_H, width: timelineW, height: rows.length * ROW_H }}>
                <defs>
                  <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-secondary)" />
                  </marker>
                  <marker id="gantt-arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="var(--error)" />
                  </marker>
                </defs>
                {arrows.map((a) => {
                  const midX = a.pred.x2 + 8;
                  const d = `M ${a.pred.x2} ${a.pred.yCenter} L ${midX} ${a.pred.yCenter} L ${midX} ${a.succ.yCenter} L ${a.succ.x1 - 2} ${a.succ.yCenter}`;
                  return (
                    <path key={a.key} d={d} fill="none" stroke={a.criticalLink ? 'var(--error)' : 'var(--text-secondary)'} strokeWidth={a.criticalLink ? 1.6 : 1.1} strokeLinejoin="round" opacity={a.criticalLink ? 0.95 : 0.5} markerEnd={`url(#${a.criticalLink ? 'gantt-arrow-critical' : 'gantt-arrow'})`} />
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
        )}
      </Card>

      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}>
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="Nom">
            <Input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder="ex : Rédiger le business plan" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phase">
              <Select value={taskForm.phaseId} onChange={(e) => setTaskForm({ ...taskForm, phaseId: e.target.value })} options={business.phases.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
            <Field label=" ">
              <label className="flex items-center gap-2 text-xs h-full pb-1.5">
                <input type="checkbox" checked={taskForm.milestone} onChange={(e) => setTaskForm({ ...taskForm, milestone: e.target.checked, endDate: e.target.checked ? taskForm.startDate : taskForm.endDate })} />
                <span className="flex items-center gap-1"><Diamond size={12} /> Jalon (durée 0)</span>
              </label>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut">
              <Select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })} options={TASK_STATUS} />
            </Field>
            <Field label={`Avancement — ${taskForm.progress}%`}>
              <input type="range" min="0" max="100" step="5" value={taskForm.progress} onChange={(e) => setTaskForm({ ...taskForm, progress: Number(e.target.value) })} className="w-full accent-[var(--accent-primary)] mt-2.5" />
            </Field>
          </div>
          <Field label="Prédécesseurs (fin → début)" hint="La tâche ne pourra pas commencer avant la fin de ses prédécesseurs — le planning se recale automatiquement.">
            <div className="max-h-36 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {allTasks.filter((t) => t.id !== editingTask?.id).length === 0 ? (
                <div className="text-xs text-mute px-3 py-2">Aucune autre tâche.</div>
              ) : allTasks.filter((t) => t.id !== editingTask?.id).map((t) => {
                const disabled = editingTask ? wouldCreateCycle(allTasks, t.id, editingTask.id) : false;
                const checked = taskForm.dependencies.includes(t.id);
                return (
                  <label key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => setTaskForm({ ...taskForm, dependencies: e.target.checked ? [...taskForm.dependencies, t.id] : taskForm.dependencies.filter((d) => d !== t.id) })}
                    />
                    <span className="text-mute w-8 shrink-0">{wbsById[t.id]}</span>
                    <span className="truncate">{t.name}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editingTask ? (
              <Button type="button" variant="danger" onClick={() => { store.deleteTask(business.id, editingTask.id); setTaskModal(false); }}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setTaskModal(false)}>Annuler</Button>
              <Button type="submit">{editingTask ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────── Palette & petits utilitaires de rendu PDF (jsPDF) ───────────
// Couleurs alignées sur la charte de l'appli (accent cyan/teal), déclinées en
// RGB pour jsPDF qui ne comprend pas les variables CSS.
const PDF_ACCENT = [13, 148, 166];
const PDF_ACCENT_LIGHT = [232, 245, 246];
const PDF_GRID = [225, 228, 231];
const PDF_MUTE = [123, 129, 135];
const PDF_INK = [28, 32, 36];
const PDF_STATUS = {
  todo: { fill: [150, 155, 161], dark: [96, 100, 105], label: 'À faire' },
  in_progress: { fill: [219, 158, 42], dark: [163, 112, 20], label: 'En cours' },
  done: { fill: [36, 168, 113], dark: [20, 118, 78], label: 'Terminée' },
};
const PDF_CRITICAL = [214, 62, 62];

function pdfTruncate(doc, text, maxW) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function pdfDiamond(doc, cx, cy, r, color) {
  doc.setFillColor(...color);
  doc.triangle(cx, cy - r, cx + r, cy, cx, cy + r, 'F');
  doc.triangle(cx, cy - r, cx - r, cy, cx, cy + r, 'F');
}

function pdfStampFooters(doc, business, marginL, marginR, pageW, pageH) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_GRID);
    doc.line(marginL, pageH - 11, pageW - marginR, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTE);
    doc.text(business.name, marginL, pageH - 7);
    doc.text(`Page ${p} / ${total}`, pageW - marginR, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }
}

// Export 1 : le diagramme de Gantt lui-même (barres, flèches, chemin
// critique) — bandeau de marque, légende, quadrillage week-end, en-tête
// mensuel répété sur chaque page, pied de page avec numérotation.
async function exportGanttPDF(business) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14, marginR = 14, marginB = 16;
  const chartXmm = 92;
  const chartRight = pageW - marginR;
  const chartWidth = chartRight - chartXmm;
  const fileBase = business.name.replace(/\s+/g, '-').toLowerCase();
  const tasks = business.tasks || [];

  function drawBanner(subtitle, right) {
    doc.setFillColor(...PDF_ACCENT);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(15);
    doc.text(business.name, marginL, 13);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, marginL, 19);
    doc.setFontSize(7.5);
    right.forEach((line, i) => doc.text(line, pageW - marginR, 12 + i * 5, { align: 'right' }));
    doc.setTextColor(0);
  }

  if (!tasks.length) {
    drawBanner('Diagramme de Gantt', [`Généré le ${new Date().toLocaleDateString('fr-FR')}`]);
    doc.setFontSize(11);
    doc.setTextColor(...PDF_MUTE);
    doc.text('Aucune tâche définie pour ce business.', marginL, 34);
    doc.save(`gantt-${fileBase}.pdf`);
    return;
  }

  const min = [...tasks.map((t) => t.startDate)].sort()[0];
  const max = [...tasks.map((t) => t.endDate)].sort().slice(-1)[0];
  const totalDays = Math.max(1, diffDays(min, max) + 1);
  const dayW = chartWidth / totalDays;
  const xFor = (dateKey) => chartXmm + diffDays(min, dateKey) * dayW;

  const phases = [...business.phases].sort((a, b) => a.order - b.order);
  const tasksByPhase = {};
  for (const t of tasks) (tasksByPhase[t.phaseId] ??= []).push(t);
  const wbsById = {};
  phases.forEach((p, pi) => (tasksByPhase[p.id] || []).sort((a, b) => a.order - b.order).forEach((t, ti) => { wbsById[t.id] = `${pi + 1}.${ti + 1}`; }));
  const critical = computeCriticalPath(tasks);
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const chartTop = 44;
  const bodyBottom = pageH - marginB - 4;
  let page = 1;

  function drawLegend(y) {
    const items = [
      { color: PDF_STATUS.todo.fill, label: PDF_STATUS.todo.label },
      { color: PDF_STATUS.in_progress.fill, label: PDF_STATUS.in_progress.label },
      { color: PDF_STATUS.done.fill, label: PDF_STATUS.done.label },
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
    doc.line(marginL, y + 1, chartRight, y + 1);
  }

  function drawWeekendStripes(yTop, yBottom) {
    doc.setFillColor(248, 249, 250);
    for (let i = 0; i < totalDays; i++) {
      const dow = toDate(addDaysKey(min, i)).getDay();
      if (dow === 0 || dow === 6) doc.rect(chartXmm + i * dayW, yTop, dayW, yBottom - yTop, 'F');
    }
  }

  function startPage() {
    drawBanner('Diagramme de Gantt', [
      `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} · ${doneCount} terminée${doneCount > 1 ? 's' : ''} · ${critical.size} critique${critical.size > 1 ? 's' : ''}`,
    ]);
    drawLegend(28);
    drawMonthRuler(38);
    drawWeekendStripes(chartTop - 4, bodyBottom);
  }

  startPage();
  let y = chartTop;
  function newPage() {
    doc.addPage('a4', 'landscape');
    page += 1;
    startPage();
    y = chartTop;
  }

  const layout = {}; // taskId -> { x1, x2, y, page }
  let zebra = 0;

  for (const phase of phases) {
    const pTasks = (tasksByPhase[phase.id] || []).sort((a, b) => a.order - b.order);
    if (!pTasks.length) continue;
    if (y > bodyBottom - 9) newPage();

    doc.setFillColor(...PDF_ACCENT_LIGHT);
    doc.rect(marginL, y - 4.4, chartRight - marginL, 6.2, 'F');
    doc.setDrawColor(...PDF_ACCENT);
    doc.setLineWidth(0.9);
    doc.line(marginL, y - 4.4, marginL, y + 1.8);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...PDF_INK);
    doc.text(pdfTruncate(doc, phase.name, chartXmm - marginL - 6), marginL + 3, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    y += 7;

    for (const t of pTasks) {
      if (y > bodyBottom) newPage();
      const isCritical = critical.has(t.id);
      if (zebra % 2 === 1) { doc.setFillColor(250, 250, 251); doc.rect(marginL, y - 4.6, chartRight - marginL, 6.4, 'F'); }
      zebra++;

      doc.setFontSize(7.2);
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : PDF_INK));
      doc.text(pdfTruncate(doc, `${wbsById[t.id]}  ${t.name}`, chartXmm - marginL - 12), marginL + 3, y);
      doc.setFontSize(6.4);
      doc.setTextColor(...PDF_MUTE);
      doc.text(`${t.progress}%`, chartXmm - 4, y, { align: 'right' });
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
        if (t.progress > 0) {
          doc.setFillColor(...darkColor);
          const pw = Math.min(w, (w * t.progress) / 100);
          doc.rect(x1, y - 3.6, pw, 3.4, 'F');
          if (pw < w) { doc.setFillColor(...fillColor); doc.rect(x1 + pw, y - 3.6, w - pw, 3.4, 'F'); doc.roundedRect(x1, y - 3.6, w, 3.4, 0.7, 0.7, 'S'); }
        }
      }
      layout[t.id] = { x1, x2: t.milestone ? x1 + 1 : x1 + w, y: y - 1.9, page };
      y += 6.4;
    }
    y += 2.4;
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

  pdfStampFooters(doc, business, marginL, marginR, pageW, pageH);
  doc.save(`gantt-${fileBase}-${todayKey()}.pdf`);
}

// Export 2 : rapport tabulaire des tâches groupées par phase — pas le
// diagramme, un vrai document imprimable (résumé chiffré, tableau par phase
// avec statut en pastille, tâches critiques repérées) pour partager
// l'avancement sans avoir besoin d'ouvrir l'appli.
async function exportTasksReportPDF(business) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14, marginR = 14, marginB = 16;
  const contentW = pageW - marginL - marginR;
  const fileBase = business.name.replace(/\s+/g, '-').toLowerCase();

  const tasks = business.tasks || [];
  const phases = [...business.phases].sort((a, b) => a.order - b.order);
  const tasksByPhase = {};
  for (const t of tasks) (tasksByPhase[t.phaseId] ??= []).push(t);
  const wbsById = {};
  phases.forEach((p, pi) => (tasksByPhase[p.id] || []).sort((a, b) => a.order - b.order).forEach((t, ti) => { wbsById[t.id] = `${pi + 1}.${ti + 1}`; }));
  const critical = computeCriticalPath(tasks);

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const inProgCount = tasks.filter((t) => t.status === 'in_progress').length;
  const todoCount = tasks.length - doneCount - inProgCount;
  const totalDur = tasks.reduce((s, t) => s + durationDays(t), 0) || 1;
  const overallPct = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progress * durationDays(t), 0) / totalDur) : 0;

  const COLS = [
    { key: 'wbs', label: '#', w: 10 },
    { key: 'name', label: 'Tâche', w: 56 },
    { key: 'status', label: 'Statut', w: 26, center: true },
    { key: 'start', label: 'Début', w: 22 },
    { key: 'end', label: 'Fin', w: 22 },
    { key: 'dur', label: 'Durée', w: 16, center: true },
    { key: 'pred', label: 'Préd.', w: 16, center: true },
    { key: 'pct', label: '%', w: 14, center: true },
  ];
  const colX = [];
  { let x = marginL; for (const c of COLS) { colX.push(x); x += c.w; } }

  function drawBanner() {
    doc.setFillColor(...PDF_ACCENT);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(17);
    doc.text(business.name, marginL, 14);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9.5);
    doc.text('Rapport des tâches par phase', marginL, 21);
    doc.setFontSize(7.5);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW - marginR, 14, { align: 'right' });
    doc.setTextColor(0);
  }

  function drawSummary(y) {
    const stats = [
      { label: 'Tâches', value: String(tasks.length) },
      { label: 'Terminées', value: String(doneCount), color: PDF_STATUS.done.dark },
      { label: 'En cours', value: String(inProgCount), color: PDF_STATUS.in_progress.dark },
      { label: 'À faire', value: String(todoCount) },
      { label: 'Avancement', value: `${overallPct}%`, color: PDF_ACCENT },
      { label: 'Critiques', value: String(critical.size), color: critical.size ? PDF_CRITICAL : undefined },
    ];
    const boxW = contentW / stats.length;
    stats.forEach((s, i) => {
      const x = marginL + i * boxW;
      doc.setDrawColor(...PDF_GRID);
      doc.setFillColor(250, 250, 251);
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
    const s = PDF_STATUS[status] || PDF_STATUS.todo;
    const w = 20;
    doc.setFillColor(...s.dark);
    doc.roundedRect(x, yBase - 3.5, w, 4.3, 1, 1, 'F');
    doc.setFontSize(6.3);
    doc.setTextColor(255, 255, 255);
    doc.text(s.label, x + w / 2, yBase - 0.5, { align: 'center' });
    doc.setTextColor(0);
  }

  function drawColHeader(y) {
    doc.setFillColor(240, 242, 243);
    doc.rect(marginL, y - 4.6, contentW, 6.2, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(90);
    COLS.forEach((c, i) => {
      const x = colX[i];
      if (c.center) doc.text(c.label, x + c.w / 2, y - 1, { align: 'center' });
      else doc.text(c.label, x + 2, y - 1);
    });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    doc.setDrawColor(...PDF_GRID);
    doc.line(marginL, y + 1.4, marginL + contentW, y + 1.4);
    return y + 6.6;
  }

  let page = 1, y = 0;
  function newPage(withColHeader) {
    doc.addPage('a4', 'portrait');
    page += 1;
    drawBanner();
    y = 34;
    if (withColHeader) y = drawColHeader(y);
  }

  drawBanner();
  y = drawSummary(32);
  y += 3;

  if (!tasks.length) {
    doc.setFontSize(11);
    doc.setTextColor(...PDF_MUTE);
    doc.text('Aucune tâche définie pour ce business.', marginL, y + 6);
    doc.save(`taches-par-phase-${fileBase}.pdf`);
    return;
  }

  for (const phase of phases) {
    const pTasks = (tasksByPhase[phase.id] || []).sort((a, b) => a.order - b.order);
    if (y > pageH - marginB - 30) newPage(false);

    const pDone = pTasks.filter((t) => t.status === 'done').length;
    const pDur = pTasks.reduce((s, t) => s + durationDays(t), 0) || 1;
    const pPct = pTasks.length ? Math.round(pTasks.reduce((s, t) => s + t.progress * durationDays(t), 0) / pDur) : 0;

    doc.setFillColor(...PDF_ACCENT_LIGHT);
    doc.rect(marginL, y, contentW, 8.4, 'F');
    doc.setDrawColor(...PDF_ACCENT);
    doc.setLineWidth(1);
    doc.line(marginL, y, marginL, y + 8.4);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...PDF_INK);
    doc.text(pdfTruncate(doc, phase.name, contentW * 0.55), marginL + 3, y + 5.6);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...PDF_MUTE);
    doc.text(pTasks.length ? `${pDone}/${pTasks.length} terminées · ${pPct}% d'avancement` : 'Aucune tâche', marginL + contentW - 2, y + 5.6, { align: 'right' });
    doc.setTextColor(0);
    y += 12;

    if (!pTasks.length) { y += 3; continue; }

    y = drawColHeader(y);
    let zebra = 0;
    for (const t of pTasks) {
      if (y > pageH - marginB - 3) { newPage(true); zebra = 0; }
      const isCritical = critical.has(t.id);
      const rowTop = y - 4.6;
      if (zebra % 2 === 1) { doc.setFillColor(249, 250, 250); doc.rect(marginL, rowTop, contentW, 6.6, 'F'); }
      if (isCritical) { doc.setFillColor(...PDF_CRITICAL); doc.rect(marginL, rowTop, 1.2, 6.6, 'F'); }
      zebra++;

      doc.setFontSize(7);
      doc.setTextColor(...PDF_MUTE);
      doc.text(wbsById[t.id] || '', colX[0] + 2, y);

      doc.setFont(undefined, isCritical ? 'bold' : 'normal');
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : [40, 44, 48]));
      const name = (t.milestone ? '◆ ' : '') + t.name;
      doc.text(pdfTruncate(doc, name, COLS[1].w - 3), colX[1] + 2, y);
      doc.setFont(undefined, 'normal');

      statusPill(colX[2] + 3, y, t.status);

      doc.setTextColor(70, 74, 78);
      doc.text(t.startDate, colX[3] + 2, y);
      doc.text(t.endDate, colX[4] + 2, y);
      doc.text(`${durationDays(t)}j`, colX[5] + COLS[5].w / 2, y, { align: 'center' });

      const preds = (t.dependencies || []).map((d) => wbsById[d]).filter(Boolean).join(',') || '—';
      doc.setTextColor(...PDF_MUTE);
      doc.text(pdfTruncate(doc, preds, COLS[6].w - 2), colX[6] + COLS[6].w / 2, y, { align: 'center' });

      doc.setFont(undefined, 'bold');
      doc.setTextColor(...(isCritical ? PDF_CRITICAL : [70, 74, 78]));
      doc.text(`${t.progress}%`, colX[7] + COLS[7].w / 2, y, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0);

      y += 6.6;
    }
    y += 5;
  }

  pdfStampFooters(doc, business, marginL, marginR, pageW, pageH);
  doc.save(`taches-par-phase-${fileBase}-${todayKey()}.pdf`);
}
