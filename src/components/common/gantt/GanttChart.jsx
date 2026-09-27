import { useMemo, useState } from 'react';
import { Plus, Trash2, FileDown, FileText, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Link2, Diamond, AlertTriangle } from 'lucide-react';
import { diffDays, addDaysKey, toDate, monthGroups, durationDays, computeCriticalPath, wouldCreateCycle } from '../../../utils/gantt';
import { todayKey } from '../../../utils/formatters';
import { toast } from '../../../store/uiStore';
import { Card, Button, Field, Input, Select, Modal, EmptyState, IconButton } from '../ui';
import { exportGanttPDF, exportTasksReportPDF, numbering } from './gantt-pdf';

// The one planning chart of the app (business plans, engineering projects…).
// Finish-to-start dependencies with cascade rescheduling (done by the store),
// critical path, milestones, drag to move/resize, drag the dot to link two
// tasks, optional phases shown as collapsible summary rows.
//
// Props
//   title       name used on PDF exports
//   tasks       [{ id, name, startDate, endDate, milestone, progress, status, dependencies, groupId?, order }]
//   groups      optional [{ id, name, order }] (phases). Without it the chart is flat.
//   statuses    [{ value, label, color }]
//   onUpdate(id, patch)   → may return { ok: false, error }
//   onDelete(id)
//   onCreate(form)        optional; enables "add task" (form has the same shape as a task)
//   editStatus  show the status field in the task window
//   emptyText   message when there is no task yet
//   report      also offer the task report PDF

const COLS = { num: 34, name: 190, start: 90, end: 90, dur: 54, pred: 64, pct: 46, del: 30 };
const chartX = Object.values(COLS).reduce((a, b) => a + b, 0);
const ROW_H = 32;
const HEADER_H = 30;

function Cell({ w, className = '', children, title }) {
  return <div style={{ width: w }} title={title} className={`shrink-0 flex items-center ${className}`}>{children}</div>;
}

function LegendItem({ swatch, children }) {
  return <span className="flex items-center gap-1.5 text-[11px] text-mute whitespace-nowrap">{swatch}{children}</span>;
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 bg-surface border border-line rounded-lg px-2.5 py-1">
      <span className="text-sm font-bold font-data" style={color ? { color } : undefined}>{value}</span>
      <span className="text-[10px] text-mute">{label}</span>
    </div>
  );
}

const blankForm = (groupId, status) => ({ groupId: groupId || '', name: '', startDate: todayKey(), endDate: todayKey(), milestone: false, progress: 0, status, dependencies: [] });
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const isInProgress = (s) => s === 'in_progress' || s === 'in-progress';

export default function GanttChart({ title, tasks: allTasks, groups = null, statuses, onUpdate, onDelete, onCreate, editStatus = false, emptyText, report = false }) {
  const [dayWidth, setDayWidth] = useState(24);
  const [collapsed, setCollapsed] = useState({});
  const [preview, setPreview] = useState(null); // { taskId, startDate, endDate }
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const sortedGroups = useMemo(() => (groups ? [...groups].sort(byOrder) : null), [groups]);
  const [form, setForm] = useState(blankForm(sortedGroups?.[0]?.id, statuses[0]?.value));

  const num = useMemo(() => numbering(allTasks, sortedGroups), [allTasks, sortedGroups]);
  const critical = useMemo(() => computeCriticalPath(allTasks), [allTasks]);
  const statusOf = (v) => statuses.find((s) => s.value === v) || statuses[0];

  // One ordered list of rows shared by the table, the bars and the arrows.
  const rows = useMemo(() => {
    if (!sortedGroups) return [...allTasks].sort(byOrder).map((t) => ({ type: 'task', task: t }));
    const out = [];
    sortedGroups.forEach((g) => {
      const gTasks = allTasks.filter((t) => t.groupId === g.id).sort(byOrder);
      out.push({ type: 'group', group: g, num: String(out.filter((r) => r.type === 'group').length + 1), tasks: gTasks });
      if (!collapsed[g.id]) gTasks.forEach((t) => out.push({ type: 'task', task: t }));
    });
    return out;
  }, [allTasks, sortedGroups, collapsed]);

  const range = useMemo(() => {
    if (!allTasks.length) return null;
    const min = addDaysKey([...allTasks.map((t) => t.startDate)].sort()[0], -2);
    const max = addDaysKey([...allTasks.map((t) => t.endDate)].sort().slice(-1)[0], 3);
    return { min, max, totalDays: diffDays(min, max) + 1 };
  }, [allTasks]);

  const openAdd = (groupId) => { setEditing(null); setForm(blankForm(groupId || sortedGroups?.[0]?.id, statuses[0]?.value)); setModal(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ groupId: t.groupId || '', name: t.name, startDate: t.startDate, endDate: t.endDate, milestone: !!t.milestone, progress: Number(t.progress) || 0, status: t.status, dependencies: t.dependencies || [] });
    setModal(true);
  };
  const update = (id, patch) => {
    const res = onUpdate(id, patch);
    if (res && res.ok === false) toast(res.error, 'error');
    return res;
  };
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || (sortedGroups && !form.groupId)) return;
    const patch = { ...form };
    if (!sortedGroups) delete patch.groupId;
    if (!editStatus) delete patch.status;
    const res = editing ? onUpdate(editing.id, patch) : onCreate(patch);
    if (res && res.ok === false) { toast(res.error, 'error'); return; }
    setModal(false);
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
      const delta = Math.round((ev.clientX - startX) / dayWidth);
      if (delta !== 0) moved = true;
      let ns = orig.startDate, ne = orig.endDate;
      if (mode === 'move') { ns = addDaysKey(orig.startDate, delta); ne = addDaysKey(orig.endDate, delta); }
      else if (mode === 'resize-start') { ns = addDaysKey(orig.startDate, delta); if (ns > orig.endDate) ns = orig.endDate; }
      else if (mode === 'resize-end') { ne = addDaysKey(orig.endDate, delta); if (ne < orig.startDate) ne = orig.startDate; }
      current = { startDate: ns, endDate: ne };
      setPreview({ taskId: task.id, ...current });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setPreview(null);
      if (moved) update(task.id, current);
      else openEdit(task);
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
      dropped = true;
      const targetId = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-task-id]')?.getAttribute('data-task-id');
      if (!targetId || targetId === task.id) return;
      const target = allTasks.find((t) => t.id === targetId);
      if (!target) return;
      if ((target.dependencies || []).includes(task.id)) { toast('Ce lien existe déjà.', 'info'); return; }
      if (wouldCreateCycle(allTasks, task.id, targetId)) { toast('Impossible : les deux tâches dépendraient l’une de l’autre.', 'error'); return; }
      update(targetId, { dependencies: [...(target.dependencies || []), task.id] });
      toast(`Lien créé : ${num[task.id]} → ${num[targetId]}`, 'success');
    };
    window.addEventListener('pointerup', onUp);
    setTimeout(() => { if (!dropped) window.removeEventListener('pointerup', onUp); }, 8000);
  };

  if (sortedGroups && !sortedGroups.length) {
    return <Card title="Planning"><EmptyState>Crée d’abord une ou plusieurs phases : chaque tâche du planning appartient à une phase.</EmptyState></Card>;
  }

  const timelineW = range ? range.totalDays * dayWidth : 0;
  const today = todayKey();
  const showToday = range && today >= range.min && today <= range.max;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;
  const inProgressCount = allTasks.filter((t) => isInProgress(t.status)).length;

  const geom = {};
  if (range) {
    rows.forEach((row, ri) => {
      if (row.type !== 'task') return;
      const eff = effective(row.task);
      geom[row.task.id] = {
        x1: diffDays(range.min, eff.startDate) * dayWidth,
        x2: (diffDays(range.min, eff.endDate) + 1) * dayWidth,
        yCenter: ri * ROW_H + ROW_H / 2,
      };
    });
  }
  const arrows = [];
  rows.forEach((row) => {
    if (row.type !== 'task') return;
    for (const depId of row.task.dependencies || []) {
      const pred = geom[depId];
      const succ = geom[row.task.id];
      if (!pred || !succ) continue; // predecessor hidden in a collapsed phase
      arrows.push({ key: `${depId}-${row.task.id}`, pred, succ, criticalLink: critical.has(depId) && critical.has(row.task.id) });
    }
  });
  const weekendCols = [];
  if (range) {
    for (let i = 0; i < range.totalDays; i++) {
      const dow = toDate(addDaysKey(range.min, i)).getDay();
      if (dow === 0 || dow === 6) weekendCols.push(i * dayWidth);
    }
  }
  let zebraCounter = -1;
  const zebra = rows.map((r) => (r.type === 'task' ? ++zebraCounter % 2 : null));
  const others = allTasks.filter((t) => t.id !== editing?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {onCreate && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAdd()}><span className="flex items-center gap-2"><Plus size={13} /> Tâche</span></Button>}
          <div className="flex items-center border border-line rounded-lg overflow-hidden">
            <IconButton label="Zoom arrière" tone="ink" className="!rounded-none p-1.5" onClick={() => setDayWidth((w) => Math.max(10, w - 4))}><ZoomOut size={14} /></IconButton>
            <div className="w-px h-4 bg-line" />
            <IconButton label="Zoom avant" tone="ink" className="!rounded-none p-1.5" onClick={() => setDayWidth((w) => Math.min(44, w + 4))}><ZoomIn size={14} /></IconButton>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportGanttPDF({ title, tasks: allTasks, groups: sortedGroups })}><span className="flex items-center gap-2"><FileDown size={13} /> Planning (PDF)</span></Button>
          {report && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => exportTasksReportPDF({ title, tasks: allTasks, groups: sortedGroups })}><span className="flex items-center gap-2"><FileText size={13} /> Rapport des tâches (PDF)</span></Button>}
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

      <Card title={`Planning · ${allTasks.length} tâche${allTasks.length > 1 ? 's' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] -mt-1 mb-3 pb-3 border-b border-line">
          {statuses.map((s) => (
            <LegendItem key={s.value} swatch={<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />}>{s.label}</LegendItem>
          ))}
          <LegendItem swatch={<span className="inline-block w-2.5 h-2.5 rounded-sm border-2 shrink-0" style={{ borderColor: 'var(--error)' }} />}>Chemin critique</LegendItem>
          <LegendItem swatch={<Diamond size={11} className="shrink-0" />}>Jalon</LegendItem>
          <LegendItem swatch={<Link2 size={11} className="shrink-0" />}>Glisse le rond au bout d’une barre vers une autre tâche pour les lier</LegendItem>
        </div>

        {!allTasks.length ? (
          <EmptyState>{emptyText || 'Aucune tâche pour l’instant.'}</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-line rounded-lg shadow-sm">
            <div className="relative" style={{ width: chartX + timelineW }}>
              <div className="absolute pointer-events-none" style={{ left: chartX, top: HEADER_H, width: timelineW, height: rows.length * ROW_H }}>
                {weekendCols.map((wx, i) => (
                  <div key={i} className="absolute top-0 bottom-0" style={{ left: wx, width: dayWidth, background: 'var(--text-secondary)', opacity: 0.055 }} />
                ))}
              </div>

              <div className="flex sticky top-0 z-20 bg-surface border-b border-line shadow-sm" style={{ height: HEADER_H }}>
                <div className="sticky left-0 z-30 bg-surface flex items-center shrink-0 text-[9px] text-mute font-bold uppercase tracking-wide border-r border-line divide-x divide-line/50" style={{ width: chartX }}>
                  <Cell w={COLS.num} className="justify-center">#</Cell>
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

              {rows.map((row, ri) => {
                if (row.type === 'group') {
                  const gTasks = row.tasks;
                  const rMin = gTasks.length ? [...gTasks.map((t) => t.startDate)].sort()[0] : null;
                  const rMax = gTasks.length ? [...gTasks.map((t) => t.endDate)].sort().slice(-1)[0] : null;
                  const avgPct = gTasks.length ? Math.round(gTasks.reduce((s, t) => s + (Number(t.progress) || 0) * durationDays(t), 0) / gTasks.reduce((s, t) => s + durationDays(t), 0)) : null;
                  const isCollapsed = !!collapsed[row.group.id];
                  const barX1 = rMin ? diffDays(range.min, rMin) * dayWidth : null;
                  const barX2 = rMax ? (diffDays(range.min, rMax) + 1) * dayWidth : null;
                  return (
                    <div key={row.group.id} className="flex items-center border-b border-line" style={{ height: ROW_H, background: 'color-mix(in srgb, var(--accent-primary) 7%, var(--bg-tertiary))' }}>
                      <div className="sticky left-0 z-10 flex items-center shrink-0 text-xs border-r border-line divide-x divide-line/40" style={{ width: chartX, background: 'color-mix(in srgb, var(--accent-primary) 9%, var(--bg-tertiary))' }}>
                        <Cell w={COLS.num} className="justify-center font-bold text-[10px] text-mute">{row.num}</Cell>
                        <Cell w={COLS.name} className="px-1.5 gap-1 font-bold truncate">
                          <button type="button" aria-label={isCollapsed ? 'Déplier la phase' : 'Replier la phase'} onClick={() => setCollapsed((c) => ({ ...c, [row.group.id]: !c[row.group.id] }))} className="text-mute hover:text-accent cursor-pointer shrink-0">
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <span className="truncate" title={row.group.name}>{row.group.name}</span>
                          <span className="text-[9px] font-normal text-mute shrink-0">({gTasks.length})</span>
                        </Cell>
                        <Cell w={COLS.start} className="px-2 text-[10px] text-mute font-data">{rMin || '—'}</Cell>
                        <Cell w={COLS.end} className="px-2 text-[10px] text-mute font-data">{rMax || '—'}</Cell>
                        <Cell w={COLS.dur} className="justify-center text-[10px] text-mute">{rMin && rMax ? `${diffDays(rMin, rMax) + 1} j` : '—'}</Cell>
                        <Cell w={COLS.pred} />
                        <Cell w={COLS.pct} className="justify-center text-[10px] font-semibold">{avgPct != null ? `${avgPct}%` : '—'}</Cell>
                        <Cell w={COLS.del} className="justify-center">
                          {onCreate && <IconButton label="Ajouter une tâche à cette phase" onClick={() => openAdd(row.group.id)}><Plus size={13} /></IconButton>}
                        </Cell>
                      </div>
                      <div className="relative h-full" style={{ width: timelineW }}>
                        {barX1 != null && (
                          <div className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-sm shadow-sm" style={{ left: barX1, width: Math.max(2, barX2 - barX1 - 2), background: 'var(--text-secondary)' }}>
                            <div className="absolute inset-y-0 left-0 rounded-l-sm" style={{ width: `${avgPct ?? 0}%`, background: 'var(--accent-primary)' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const task = row.task;
                const eff = effective(task);
                const isCritical = critical.has(task.id);
                const color = statusOf(task.status)?.color || 'var(--text-secondary)';
                const pct = Number(task.progress) || 0;
                const g = geom[task.id];
                const rowBg = zebra[ri] === 1 ? 'var(--bg-tertiary)' : 'color-mix(in srgb, var(--text-secondary) 4%, var(--bg-tertiary))';
                const preds = (task.dependencies || []).map((d) => num[d]).filter(Boolean);
                return (
                  <div key={task.id} className="flex items-center border-b border-line/30 group" style={{ height: ROW_H }}>
                    <div className="sticky left-0 z-10 flex items-center shrink-0 text-xs border-r border-line divide-x divide-line/30" style={{ width: chartX, background: rowBg }}>
                      <Cell w={COLS.num} className="justify-center text-[10px] text-mute font-data">{num[task.id]}</Cell>
                      <Cell w={COLS.name} className="px-1.5 gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        {task.milestone && <Diamond size={10} className="shrink-0 text-mute" />}
                        <button type="button" className="truncate text-left hover:underline hover:text-accent cursor-pointer" title={task.name} onClick={() => openEdit(task)}>{task.name}</button>
                        {isCritical && <AlertTriangle size={10} className="shrink-0 ml-auto" style={{ color: 'var(--error)' }} aria-label="Chemin critique" />}
                      </Cell>
                      <Cell w={COLS.start} className="px-1.5">
                        <input type="date" aria-label="Début" value={task.startDate} onChange={(e) => update(task.id, { startDate: e.target.value })} className="w-full bg-transparent text-[10px] font-data text-mute focus:outline-none focus:text-ink cursor-pointer" />
                      </Cell>
                      <Cell w={COLS.end} className="px-1.5">
                        <input type="date" aria-label="Fin" value={task.endDate} disabled={task.milestone} onChange={(e) => update(task.id, { endDate: e.target.value })} className="w-full bg-transparent text-[10px] font-data text-mute focus:outline-none focus:text-ink cursor-pointer disabled:opacity-40" />
                      </Cell>
                      <Cell w={COLS.dur} className="justify-center">
                        <input type="number" aria-label="Durée en jours" min="1" value={durationDays(eff)} disabled={task.milestone} onChange={(e) => update(task.id, { endDate: addDaysKey(task.startDate, Math.max(1, Number(e.target.value) || 1) - 1) })} className="w-9 bg-transparent text-[10px] text-mute text-center focus:outline-none focus:text-ink disabled:opacity-40" />
                      </Cell>
                      <Cell w={COLS.pred} className="justify-center text-[9px] text-mute truncate font-data" title={preds.join(', ')}>{preds.join(',') || '—'}</Cell>
                      <Cell w={COLS.pct} className="justify-center">
                        <input type="number" aria-label="Avancement en %" min="0" max="100" step="5" value={pct} onChange={(e) => update(task.id, { progress: Number(e.target.value) || 0 })} className="w-8 bg-transparent text-[10px] font-semibold text-mute text-center focus:outline-none focus:text-ink" />
                      </Cell>
                      <Cell w={COLS.del} className="justify-center sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <IconButton label={`Supprimer ${task.name}`} tone="danger" onClick={() => { if (confirm(`Supprimer la tâche « ${task.name} » ?`)) onDelete(task.id); }}><Trash2 size={12} /></IconButton>
                      </Cell>
                    </div>
                    <div className="relative h-full" style={{ width: timelineW, background: rowBg }}>
                      {task.milestone ? (
                        <div
                          data-task-id={task.id}
                          className="absolute top-1/2 rotate-45 cursor-grab active:cursor-grabbing shadow-sm touch-none"
                          style={{ left: g.x1 + dayWidth / 2 - 6, marginTop: -6, width: 12, height: 12, borderRadius: 2, background: color, border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 60%, black)` }}
                          onPointerDown={(e) => startDrag(e, task, 'move')}
                          title={`◆ ${task.name} · ${task.startDate}`}
                        />
                      ) : (
                        <div
                          data-task-id={task.id}
                          className="absolute top-2 bottom-2 rounded-md flex items-center px-1.5 cursor-grab active:cursor-grabbing select-none shadow-sm touch-none"
                          style={{
                            left: g.x1,
                            width: Math.max(dayWidth * 0.6, g.x2 - g.x1 - 2),
                            background: `linear-gradient(180deg, color-mix(in srgb, ${color} 26%, var(--bg-tertiary)), color-mix(in srgb, ${color} 16%, var(--bg-tertiary)))`,
                            border: isCritical ? '2px solid var(--error)' : `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
                          }}
                          onPointerDown={(e) => startDrag(e, task, 'move')}
                          title={`${task.startDate} → ${task.endDate} · ${pct}%${isCritical ? ' · critique' : ''}`}
                        >
                          <div className="absolute inset-y-0 left-0 rounded-l-md pointer-events-none" style={{ width: `${pct}%`, background: `color-mix(in srgb, ${color} 60%, transparent)` }} />
                          <span className="relative text-[10px] font-semibold truncate z-10 text-ink">{task.name}</span>
                          <span onPointerDown={(e) => startDrag(e, task, 'resize-start')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                          <span onPointerDown={(e) => startDrag(e, task, 'resize-end')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                        </div>
                      )}
                      <div
                        onPointerDown={(e) => startLink(e, task)}
                        title="Glisse vers une autre tâche pour créer un lien"
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full cursor-crosshair border-2 border-card z-10 opacity-0 group-hover:opacity-100 hover:scale-125 transition-all shadow touch-none"
                        style={{ left: g.x2 - 3, background: color }}
                      />
                    </div>
                  </div>
                );
              })}

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
                  return <path key={a.key} d={d} fill="none" stroke={a.criticalLink ? 'var(--error)' : 'var(--text-secondary)'} strokeWidth={a.criticalLink ? 1.6 : 1.1} strokeLinejoin="round" opacity={a.criticalLink ? 0.95 : 0.5} markerEnd={`url(#${a.criticalLink ? 'gantt-arrow-critical' : 'gantt-arrow'})`} />;
                })}
              </svg>

              {showToday && (
                <div className="absolute z-10 pointer-events-none" style={{ left: chartX + diffDays(range.min, today) * dayWidth, top: HEADER_H, bottom: 0 }}>
                  <div className="absolute top-0 h-full border-l-2 border-dashed" style={{ borderColor: 'var(--accent-primary)' }} />
                  <div className="absolute top-0 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-b bg-accent text-on-accent">Auj.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nom">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Rédiger le cahier des charges" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {sortedGroups && (
              <Field label="Phase">
                <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} options={sortedGroups.map((g) => ({ value: g.id, label: g.name }))} />
              </Field>
            )}
            <Field label=" ">
              <label className="flex items-center gap-2 text-xs h-full pb-1.5">
                <input type="checkbox" checked={form.milestone} onChange={(e) => setForm({ ...form, milestone: e.target.checked, endDate: e.target.checked ? form.startDate : form.endDate })} />
                <span className="flex items-center gap-1"><Diamond size={12} /> Jalon (durée 0)</span>
              </label>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.milestone ? e.target.value : form.endDate })} />
            </Field>
            <Field label="Fin">
              <Input type="date" value={form.endDate} min={form.startDate} disabled={form.milestone} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
            <Field label="Durée (j)">
              <Input type="number" min="1" disabled={form.milestone} value={form.milestone ? 0 : diffDays(form.startDate, form.endDate) + 1}
                onChange={(e) => setForm({ ...form, endDate: addDaysKey(form.startDate, Math.max(1, Number(e.target.value) || 1) - 1) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {editStatus && (
              <Field label="Statut">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statuses} />
              </Field>
            )}
            <Field label={`Avancement : ${form.progress} %`}>
              <input type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full mt-2.5" />
            </Field>
          </div>
          <Field label="Tâches à finir avant" hint="Cette tâche ne pourra pas commencer avant la fin de celles-ci : le planning se recale tout seul.">
            <div className="max-h-36 overflow-y-auto border border-line rounded-lg divide-y divide-line/50">
              {others.length === 0 ? (
                <div className="text-xs text-mute px-3 py-2">Aucune autre tâche.</div>
              ) : others.map((t) => {
                const disabled = editing ? wouldCreateCycle(allTasks, t.id, editing.id) : false;
                return (
                  <label key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface'}`}>
                    <input
                      type="checkbox"
                      checked={form.dependencies.includes(t.id)}
                      disabled={disabled}
                      onChange={(e) => setForm({ ...form, dependencies: e.target.checked ? [...form.dependencies, t.id] : form.dependencies.filter((d) => d !== t.id) })}
                    />
                    <span className="text-mute w-8 shrink-0 font-data">{num[t.id]}</span>
                    <span className="truncate">{t.name}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-between gap-3 pt-2 border-t border-line">
            {editing ? (
              <Button type="button" variant="danger" onClick={() => { if (confirm(`Supprimer la tâche « ${editing.name} » ?`)) { onDelete(editing.id); setModal(false); } }}><span className="flex items-center gap-2"><Trash2 size={14} /> Supprimer</span></Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
              <Button type="submit">{editing ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
