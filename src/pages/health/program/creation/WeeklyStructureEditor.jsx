import { useState } from 'react';
import { Calendar, Moon, Clock, MapPin } from 'lucide-react';
import { Card, Button, Select, Input, Badge } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function WeeklyStructureEditor({ phaseId }) {
  const { getWeeklyForPhase, getSessionsForPhase, setDayPlan, locations } = useProgramStore();
  const weekDays = getWeeklyForPhase(phaseId);
  const sessions = getSessionsForPhase(phaseId);
  const [saving, setSaving] = useState(null); // dayOfWeek being saved

  // Build a map dayOfWeek -> existing dayPlan (or defaults)
  const dayPlanMap = {};
  for (const d of weekDays) dayPlanMap[d.day_of_week] = d;

  const handleChange = async (dayOfWeek, updates) => {
    setSaving(dayOfWeek);
    try {
      const current = dayPlanMap[dayOfWeek] || { is_rest_day: false, session_ids: [], scheduled_time: null, duration_min: null, location_id: null };
      await setDayPlan(phaseId, dayOfWeek, { ...current, ...updates });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const toggleRestDay = async (dayOfWeek) => {
    const current = dayPlanMap[dayOfWeek];
    const isRest = !current?.is_rest_day;
    await handleChange(dayOfWeek, { is_rest_day: isRest, session_ids: isRest ? [] : current?.session_ids || [] });
  };

  const toggleSession = async (dayOfWeek, sessionId) => {
    const current = dayPlanMap[dayOfWeek] || { session_ids: [] };
    const ids = current.session_ids || [];
    const updated = ids.includes(sessionId) ? ids.filter((id) => id !== sessionId) : [...ids, sessionId];
    await handleChange(dayOfWeek, { session_ids: updated, is_rest_day: false });
  };

  return (
    <Card title="Structure hebdomadaire" action={
      <span className="text-xs text-mute">{sessions.length} séance(s) disponible(s)</span>
    }>
      {!sessions.length && (
        <div className="text-sm text-mute mb-4 px-2 py-3 border border-line rounded-lg bg-surface">
          ⚠️ Créez d'abord des séances dans cette phase avant de les assigner aux jours.
        </div>
      )}

      <div className="space-y-2">
        {DAY_LABELS.map((label, dayIdx) => {
          const dp = dayPlanMap[dayIdx];
          const isRest = dp?.is_rest_day;
          const assignedSessions = (dp?.session_ids || []).map((id) => sessions.find((s) => s.id === id)).filter(Boolean);

          return (
            <div key={dayIdx} className={`border rounded-lg p-3 transition-colors ${isRest ? 'border-line bg-surface/50 opacity-70' : 'border-line hover:border-accent/40'}`}>
              <div className="flex items-center justify-between gap-3">
                {/* Day label + rest toggle */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <span className="text-sm font-semibold w-20">{label}</span>
                  <button
                    onClick={() => toggleRestDay(dayIdx)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                      isRest ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'
                    }`}
                  >
                    <Moon size={12} /> Repos
                  </button>
                </div>

                {!isRest && (
                  <div className="flex items-center gap-2 flex-1">
                    {/* Session assignment chips */}
                    <div className="flex flex-wrap gap-1 flex-1">
                      {sessions.map((sess) => {
                        const active = (dp?.session_ids || []).includes(sess.id);
                        return (
                          <button
                            key={sess.id}
                            onClick={() => toggleSession(dayIdx, sess.id)}
                            className={`text-xs px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                              active ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-line text-mute hover:text-ink hover:border-accent/30'
                            }`}
                          >
                            {sess.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Time picker */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock size={12} className="text-mute" />
                      <input
                        type="time"
                        value={dp?.scheduled_time || ''}
                        onChange={(e) => handleChange(dayIdx, { scheduled_time: e.target.value || null })}
                        className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink w-24"
                      />
                    </div>

                    {/* Duration */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        value={dp?.duration_min || ''}
                        onChange={(e) => handleChange(dayIdx, { duration_min: parseInt(e.target.value) || null })}
                        placeholder="min"
                        className="!w-16 !py-1 !px-2 !text-xs text-center"
                      />
                    </div>

                    {/* Location */}
                    {locations.length > 0 && (
                      <div className="shrink-0">
                        <select
                          value={dp?.location_id || ''}
                          onChange={(e) => handleChange(dayIdx, { location_id: e.target.value || null })}
                          className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink"
                        >
                          <option value="">— Lieu —</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {isRest && (
                  <div className="flex-1 text-xs text-mute italic">Jour de repos</div>
                )}

                {saving === dayIdx && <span className="text-[10px] text-accent">⏳</span>}
              </div>

              {/* Show assigned sessions summary */}
              {!isRest && assignedSessions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pl-[140px]">
                  {assignedSessions.map((s) => (
                    <Badge key={s.id} color={s.type === 'strength' ? 'var(--accent-primary)' : s.type === 'cardio' ? 'var(--success)' : 'var(--warning)'}>
                      {s.type === 'strength' ? '🏋️' : s.type === 'cardio' ? '🫀' : '🤸'} {s.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
