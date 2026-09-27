// Shared helpers of programStore.js (moved verbatim, F3).
import { useHealthStore } from '../healthStore';
import { useHabitStore } from '../habitStore';
import { buildMetricSource } from '../../utils/metric-engine';

/**
 * programStore.js — Zustand store for Programme.
 *
 * NOT persisted to localStorage — all data lives in Supabase.
 * This store is an in-memory cache refreshed on load and after mutations.
 * Without an internet connection, Programme is unavailable.
 */


// KPI data adapter lives in utils/metric-engine (shared with the unified goals).
export function buildKpiSource() {
  let h = {}; let hb = {};
  try { h = useHealthStore.getState(); } catch { /* noop */ }
  try { hb = useHabitStore.getState(); } catch { /* noop */ }
  return buildMetricSource(h, hb);
}

export const isoDay = (offset) => {
  const d = new Date(Date.now() - offset * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const summarize = (series) => {
  const latest = series.length ? series[series.length - 1] : null;
  const previous = series.length >= 2 ? series[series.length - 2] : null;
  const trend = latest && previous ? Math.round((latest.value - previous.value) * 100) / 100 : null;
  return { series, latest, previous, trend };
};
