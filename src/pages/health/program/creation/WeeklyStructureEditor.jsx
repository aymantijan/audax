import { useState } from 'react';
import { Moon, Clock, MapPin, Timer, AlertTriangle, CalendarDays } from 'lucide-react';
import { useProgramStore } from '../../../../store/programStore';
import { toast } from '../../../../store/uiStore';
import { typeMeta, tint, TypeBadge } from '../shared/design';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Effective slot of a session on a day: its own slot, else the legacy day-level values. */
export function slotFor(dayPlan, session) {
  const own = dayPlan?.session_slots?.[session.id] || {};
  return {
    time: own.time ?? dayPlan?.scheduled_time ?? null,
    duration_min: own.duration_min ?? session.estimated_duration_min ?? dayPlan?.duration_min ?? null,
    location_id: own.location_id ?? dayPlan?.location_id ?? null,
  };
}

const byTime = (a, b) => (a.slot.time || '99:99').localeCompare(b.slot.time || '99:99');

export default function WeeklyStructureEditor({ phaseId }) {
  const { getWeeklyForPhase, getSessionsForPhase, setDayPlan, locations } = useProgramStore();
  const weekDays = getWeeklyForPhase(phaseId);
  const sessions = getSessionsForPhase(phaseId);
  const [saving, setSaving] = useState(null);

  const dayPlanMap = {};
  for (const d of weekDays) dayPlanMap[d.day_of_week] = d;
  const slotsNotPersisted = weekDays.some((d) => d._slotsNotPersisted);

  const save = async (dayOfWeek, updates) => {
    setSaving(dayOfWeek);
    try {
      const current = dayPlanMap[dayOfWeek] || { is_rest_day: false, session_ids: [], session_slots: {} };
      await setDayPlan(phaseId, dayOfWeek, { ...current, ...updates });
    } catch (err) {
      toast(err?.message || 'Enregistrement impossible', 'error');
    } finally {
      setSaving(null);
    }
  };

  const toggleRestDay = (dow) => {
    const isRest = !dayPlanMap[dow]?.is_rest_day;
    save(dow, { is_rest_day: isRest, session_ids: isRest ? [] : dayPlanMap[dow]?.session_ids || [] });
  };

  const toggleSession = (dow, session) => {
    const dp = dayPlanMap[dow] || {};
    const ids = dp.session_ids || [];
    const slots = { ...(dp.session_slots || {}) };
    let next;
    if (ids.includes(session.id)) {
      next = ids.filter((id) => id !== session.id);
      delete slots[session.id];
    } else {
      next = [...ids, session.id];
      slots[session.id] = { time: null, duration_min: session.estimated_duration_min ?? null, location_id: dp.location_id ?? null };
    }
    save(dow, { session_ids: next, session_slots: slots, is_rest_day: false });
  };

  const updateSlot = (dow, session, patch) => {
    const dp = dayPlanMap[dow] || {};
    const slots = { ...(dp.session_slots || {}) };
    slots[session.id] = { ...slotFor(dp, session), ...(slots[session.id] || {}), ...patch };
    save(dow, { session_slots: slots });
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink"><CalendarDays size={16} className="text-accent" /> Structure hebdomadaire</h3>
          <p className="mt-0.5 text-xs text-mute">Cochez les séances de chaque jour — chacune a sa propre heure, durée et lieu.</p>
        </div>
        <span className="text-xs text-mute">{sessions.length} séance(s)</span>
      </div>

      {slotsNotPersisted && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Les heures par séance ne sont pas encore enregistrées en base : la migration 004 doit être exécutée dans Supabase.
        </div>
      )}

      {!sessions.length && (
        <div className="rounded-lg border border-line bg-surface px-3 py-3 text-sm text-mute">Créez d’abord des séances dans cette phase.</div>
      )}

      {/* Week at a glance */}
      {sessions.length > 0 && (
        <div className="mb-5 grid grid-cols-7 gap-1.5">
          {DAY_SHORT.map((label, dow) => {
            const dp = dayPlanMap[dow];
            const items = (dp?.session_ids || [])
              .map((id) => sessions.find((s) => s.id === id)).filter(Boolean)
              .map((s) => ({ s, slot: slotFor(dp, s) })).sort(byTime);
            return (
              <div key={dow} className={`min-h-[76px] rounded-lg border p-1.5 ${dp?.is_rest_day ? 'border-line/60 bg-surface/40' : 'border-line bg-surface'}`}>
                <div className="mb-1 text-center text-[10px] font-semibold uppercase text-mute">{label}</div>
                {dp?.is_rest_day ? (
                  <div className="flex justify-center pt-2 text-mute"><Moon size={13} /></div>
                ) : (
                  <div className="space-y-1">
                    {items.map(({ s, slot }) => {
                      const m = typeMeta(s.type);
                      return (
                        <div key={s.id} className="truncate rounded px-1 py-0.5 text-[10px] font-medium" style={{ background: tint(m.color, 18), color: m.color }} title={`${s.label}${slot.time ? ' · ' + slot.time : ''}`}>
                          {slot.time ? slot.time.slice(0, 5) + ' ' : ''}{s.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Per-day editor */}
      <div className="space-y-2.5">
        {DAY_LABELS.map((label, dow) => {
          const dp = dayPlanMap[dow];
          const isRest = dp?.is_rest_day;
          const assigned = (dp?.session_ids || [])
            .map((id) => sessions.find((s) => s.id === id)).filter(Boolean)
            .map((s) => ({ s, slot: slotFor(dp, s) })).sort(byTime);

          return (
            <div key={dow} className={`rounded-xl border p-3.5 transition-colors ${isRest ? 'border-line/60 bg-surface/40' : 'border-line bg-surface/70'}`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="w-20 text-sm font-semibold text-ink">{label}</span>
                <button
                  type="button"
                  onClick={() => toggleRestDay(dow)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors cursor-pointer ${isRest ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}
                >
                  <Moon size={12} /> Repos
                </button>
                {!isRest && (
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {sessions.map((s) => {
                      const active = (dp?.session_ids || []).includes(s.id);
                      const m = typeMeta(s.type);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSession(dow, s)}
                          className="rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer"
                          style={active
                            ? { borderColor: m.color, background: tint(m.color, 16), color: m.color }
                            : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isRest && <span className="text-xs italic text-mute">Jour de repos</span>}
                {saving === dow && <span className="text-[10px] text-accent">Enregistrement…</span>}
              </div>

              {/* One slot row per assigned session */}
              {!isRest && assigned.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {assigned.map(({ s, slot }) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card/70 px-2.5 py-2">
                      <div className="flex min-w-[150px] flex-1 items-center gap-2">
                        <TypeBadge type={s.type} compact />
                        <span className="truncate text-sm font-medium text-ink">{s.label}</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-mute">
                        <Clock size={13} />
                        <input
                          type="time"
                          value={slot.time ? slot.time.slice(0, 5) : ''}
                          onChange={(e) => updateSlot(dow, s, { time: e.target.value || null })}
                          className="w-[92px] rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-mute">
                        <Timer size={13} />
                        <input
                          type="number"
                          min={0}
                          key={`${s.id}-${slot.duration_min}`}
                          defaultValue={slot.duration_min ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            if (v !== slot.duration_min) updateSlot(dow, s, { duration_min: v });
                          }}
                          placeholder="min"
                          className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-center text-xs text-ink outline-none focus:border-accent"
                        />
                        min
                      </label>
                      {locations.length > 0 && (
                        <label className="flex items-center gap-1.5 text-xs text-mute">
                          <MapPin size={13} />
                          <select
                            value={slot.location_id || ''}
                            onChange={(e) => updateSlot(dow, s, { location_id: e.target.value || null })}
                            className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                          >
                            <option value="">— Lieu —</option>
                            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
