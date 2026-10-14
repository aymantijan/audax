// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';

const loadedWeeks = new Set(); // `${programId}|${monday}` already fetched by ensureWeekLoaded

export const dailySlice = (set, get) => ({
  // Wave 2 — Daily usage, overrides, session logs, nutrition, habits
  // =====================================================================

  // Overrides keyed by 'YYYY-MM-DD' → override[]
  overridesByDate: {},

  // Session logs keyed by 'YYYY-MM-DD' → log[]
  sessionLogsByDate: {},

  // Nutrition templates keyed by phaseId → template[]
  nutritionByPhase: {},

  // Habit links for current program
  habitLinks: [],

  // --- Daily view computation ---

  /**
   * Returns the scheduled events for a given date, taking overrides into account.
   * Computes from weekly_structure + phase dates — no materialized schedule needed.
   * @param {string} dateStr — 'YYYY-MM-DD'
   * @returns {Array<{session, planned_time, location_id, override, logged}>}
   */
  getScheduleForDate: (dateStr) => {
    const s = get();
    const program = s.activeProgram;
    if (!program) return [];

    // Find which phase this date falls in
    const phase = s.phases.find((p) =>
      p.start_date <= dateStr && p.end_date >= dateStr
    );
    if (!phase) return [];

    // Day of week (0=Mon … 6=Sun, matching our weekly_structure)
    const d = new Date(dateStr + 'T12:00:00');
    const jsDay = d.getDay(); // 0=Sun
    const dow = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon

    const weeklyDays = s.weeklyByPhase[phase.id] || [];
    const dayPlan = weeklyDays.find((w) => w.day_of_week === dow);
    if (!dayPlan || dayPlan.is_rest_day) return [];

    const overrides = (s.overridesByDate[dateStr] || []);
    const logs = (s.sessionLogsByDate[dateStr] || []);
    const sessions = s.sessionsByPhase[phase.id] || [];

    // Build scheduled events from session_ids. Each session uses its OWN slot
    // (time / duration / location, migration 004) — cardio at 06:05 and
    // strength at 17:00 on the same day — falling back to the legacy day-level
    // values. Events are returned in chronological order.
    return (dayPlan.session_ids || []).map((sessId) => {
      const session = sessions.find((ss) => ss.id === sessId);
      if (!session) return null;

      const own = dayPlan.session_slots?.[sessId] || {};
      const baseTime = own.time ?? dayPlan.scheduled_time ?? null;
      const baseLocation = own.location_id ?? dayPlan.location_id ?? null;
      const duration = own.duration_min ?? session.estimated_duration_min ?? dayPlan.duration_min ?? null;

      const override = overrides.find((o) => o.original_session_id === sessId);
      const log = logs.find((l) => l.session_id === sessId);

      if (override?.action === 'cancel') {
        return { session, planned_time: baseTime, duration_min: duration, location_id: baseLocation, override, logged: log, cancelled: true, phase };
      }
      if (override?.action === 'reschedule' && override.new_date && override.new_date !== dateStr) {
        return { session, planned_time: baseTime, duration_min: duration, location_id: baseLocation, override, logged: log, moved: true, phase };
      }
      return {
        session,
        planned_time: override?.new_time || baseTime,
        duration_min: duration,
        location_id: override?.new_location_id || baseLocation,
        override,
        logged: log,
        cancelled: false,
        moved: false,
        phase,
      };
    }).filter(Boolean)
      .sort((a, b) => (a.planned_time || '99:99').localeCompare(b.planned_time || '99:99'));
  },

  /**
   * Get today's schedule (convenience).
   */
  getTodaySchedule: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().getScheduleForDate(today);
  },

  // --- Overrides ---

  loadOverrides: async (programId, dateFrom, dateTo) => {
    try {
      const overrides = await api.fetchOverrides(programId, dateFrom, dateTo);
      const map = {};
      for (const o of overrides) (map[o.target_date] ||= []).push(o);
      set({ overridesByDate: { ...get().overridesByDate, ...map } });
      return overrides;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  createOverride: async (programId, data) => {
    try {
      const override = await api.createOverride(programId, data);
      const s = get();
      const key = override.target_date;
      const existing = s.overridesByDate[key] || [];
      const idx = existing.findIndex((o) => o.id === override.id);
      const updated = idx >= 0
        ? existing.map((o) => o.id === override.id ? override : o)
        : [...existing, override];
      set({ overridesByDate: { ...s.overridesByDate, [key]: updated } });
      return override;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  /**
   * Cancel a session on a given date with cascade.
   * Cascade: remaining sessions that week shift +1 day, never past Sunday.
   */
  cancelSessionWithCascade: async (programId, dateStr, sessionId, reasonCode, reasonNote) => {
    try {
      // 1. Create the cancel override
      await get().createOverride(programId, {
        target_date: dateStr,
        original_session_id: sessionId,
        action: 'cancel',
        reason_code: reasonCode,
        reason_note: reasonNote,
        cascade_applied: true,
      });

      // 2. Find remaining sessions this week after dateStr and shift +1
      const d = new Date(dateStr + 'T12:00:00');
      const jsDay = d.getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1;
      // Days left in the week (Mon=0..Sun=6), don't go past Sunday
      for (let dayOffset = 1; dow + dayOffset <= 6; dayOffset++) {
        const checkDate = new Date(d.getTime() + dayOffset * 86400000);
        const checkStr = checkDate.toISOString().slice(0, 10);
        const scheduled = get().getScheduleForDate(checkStr);

        for (const evt of scheduled) {
          if (evt.cancelled || evt.moved) continue;
          // Shift this session +1 day
          // Never out of the week: a Sunday session stays where it is (the old
          // check compared a day number that wraps to Monday, so it never fired).
          if (dow + dayOffset >= 6) continue;
          const newDate = new Date(checkDate.getTime() + 86400000);
          const newDateStr = newDate.toISOString().slice(0, 10);

          await get().createOverride(programId, {
            target_date: checkStr,
            original_session_id: evt.session.id,
            action: 'reschedule',
            new_date: newDateStr,
            new_time: evt.planned_time,
            reason_code: 'cascade',
            reason_note: `Décalé suite à l'annulation du ${dateStr}`,
            cascade_applied: true,
          });
        }
      }
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  /**
   * Puts a cancelled / moved session back as planned. A cancellation that
   * shifted the rest of the week (cascade) gives those sessions back their day too.
   */
  undoOverride: async (programId, override) => {
    const dateStr = override.target_date;
    if (override.action === 'cancel' && override.cascade_applied) {
      const d = new Date(dateStr + 'T12:00:00');
      const end = new Date(d.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      await get().loadOverrides(programId, dateStr, end);
      const note = `Décalé suite à l'annulation du ${dateStr}`;
      for (const [day, list] of Object.entries(get().overridesByDate)) {
        for (const o of list) {
          if (o.reason_code === 'cascade' && o.reason_note === note) await get().removeOverride(o.id, day);
        }
      }
    }
    await get().removeOverride(override.id, dateStr);
  },

  /**
   * The daily view can go back (or forward) any number of weeks: load that
   * week's overrides and logs once, so a past session shows its real status.
   */
  ensureWeekLoaded: async (programId, dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
    const key = `${programId}|${monday}`;
    if (loadedWeeks.has(key)) return;
    loadedWeeks.add(key);
    const sunday = new Date(new Date(monday + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10);
    try {
      await Promise.all([get().loadOverrides(programId, monday, sunday), get().loadSessionLogs(programId, monday, sunday)]);
    } catch {
      loadedWeeks.delete(key); // try again next time
    }
  },

  removeOverride: async (overrideId, dateStr) => {
    try {
      await api.deleteOverride(overrideId);
      const s = get();
      const updated = (s.overridesByDate[dateStr] || []).filter((o) => o.id !== overrideId);
      set({ overridesByDate: { ...s.overridesByDate, [dateStr]: updated } });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },
});
