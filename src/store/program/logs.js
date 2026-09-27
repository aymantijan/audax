// Slice of programStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../programStore.js.
import * as api from '../../services/program-api';

export const logsSlice = (set, get) => ({
  // --- Session Logs ---

  loadSessionLogs: async (programId, dateFrom, dateTo) => {
    try {
      const logs = await api.fetchSessionLogs(programId, dateFrom, dateTo);
      const map = {};
      for (const l of logs) (map[l.planned_date] ||= []).push(l);
      set({ sessionLogsByDate: { ...get().sessionLogsByDate, ...map } });
      return logs;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  logSession: async (data) => {
    try {
      const log = await api.createSessionLog(data);
      const s = get();
      const key = log.planned_date;
      const existing = s.sessionLogsByDate[key] || [];
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [key]: [...existing, log] } });
      return log;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateSessionLog: async (logId, dateStr, updates) => {
    try {
      const updated = await api.updateSessionLog(logId, updates);
      const s = get();
      const list = (s.sessionLogsByDate[dateStr] || []).map((l) => l.id === logId ? updated : l);
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [dateStr]: list } });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeSessionLog: async (logId, dateStr) => {
    try {
      await api.deleteSessionLog(logId);
      const s = get();
      const list = (s.sessionLogsByDate[dateStr] || []).filter((l) => l.id !== logId);
      set({ sessionLogsByDate: { ...s.sessionLogsByDate, [dateStr]: list } });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  // --- Nutrition Templates ---

  loadNutritionTemplates: async (programId) => {
    try {
      const map = await api.fetchAllNutritionTemplates(programId);
      set({ nutritionByPhase: { ...get().nutritionByPhase, ...map } });
      return map;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  createNutritionTemplate: async (phaseId, data) => {
    try {
      const template = await api.createNutritionTemplate(phaseId, data);
      const s = get();
      const existing = s.nutritionByPhase[phaseId] || [];
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: [...existing, template] } });
      return template;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateNutritionTemplate: async (phaseId, templateId, updates) => {
    try {
      const updated = await api.updateNutritionTemplate(templateId, updates);
      const s = get();
      const list = (s.nutritionByPhase[phaseId] || []).map((t) => t.id === templateId ? updated : t);
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: list } });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeNutritionTemplate: async (phaseId, templateId) => {
    try {
      await api.deleteNutritionTemplate(templateId);
      const s = get();
      const list = (s.nutritionByPhase[phaseId] || []).filter((t) => t.id !== templateId);
      set({ nutritionByPhase: { ...s.nutritionByPhase, [phaseId]: list } });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  getNutritionForPhase: (phaseId) => get().nutritionByPhase[phaseId] || [],

  // --- Habit Links ---

  loadHabitLinks: async (programId) => {
    try {
      const links = await api.fetchHabitLinks(programId);
      set({ habitLinks: links });
      return links;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  createHabitLink: async (programId, data) => {
    try {
      const link = await api.createHabitLink(programId, data);
      const s = get();
      const existing = s.habitLinks.filter((l) => l.id !== link.id);
      set({ habitLinks: [...existing, link] });
      return link;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  updateHabitLink: async (linkId, updates) => {
    try {
      const updated = await api.updateHabitLink(linkId, updates);
      set({ habitLinks: get().habitLinks.map((l) => l.id === linkId ? updated : l) });
      return updated;
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  removeHabitLink: async (linkId) => {
    try {
      await api.deleteHabitLink(linkId);
      set({ habitLinks: get().habitLinks.filter((l) => l.id !== linkId) });
    } catch (err) {
      throw err; // surfaced by the calling form — not the page-level error screen
    }
  },

  getHabitLinksForSession: (sessionId) => get().habitLinks.filter((l) => l.session_id === sessionId),

  // =====================================================================
});
