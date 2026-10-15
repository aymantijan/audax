// Slice of healthStore.js — « Santé du quotidien » (chantier 7): medications,
// medical measures, appointments, documents, emergency card. Kept inside the
// health store so it syncs with it (app_state 'health') and the push job
// (api/class-reminders.js) can read medications and appointments.
// Rules: utils/care.js. Deletions go through services/undo.js on screen.
import { uid, todayKey } from '../../utils/formatters';
import { toast } from '../uiStore';

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } };
const byDate = (a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`);

// Empty state of this slice — also what « Effacer mes données » puts back (resetAll).
export const careInitial = () => ({
  medications: [], // [{ id, name, dose, times[], frequency, weekdays[], startDate, endDate, stock, stockDate, perDose, notes, remind, active }]
  medLogs: [], // [{ id, medId, date, time, status: 'taken'|'skipped', at }]
  vitals: [], // [{ id, type, date, time, value?, systolic?, diastolic?, context?, notes }]
  appointments: [], // [{ id, date, time, title, place, who, notes, done }]
  healthDocs: [], // [{ id, kind, date, title, notes, photo, nextDate }]
  emergencyCard: { bloodType: '', allergies: '', conditions: '', doctor: '', notes: '', contacts: [{ name: '', relation: '', phone: '' }] },
  careTimezone: null, // the person's time zone, for push reminders
});

export const careSlice = (set, get) => ({
  ...careInitial(),

  // ─────────── Medications ───────────
  addMedication: (data) => {
    const med = { id: uid(), frequency: 'daily', times: [], weekdays: [], startDate: todayKey(), endDate: null, stock: null, stockDate: todayKey(), perDose: 1, notes: '', remind: true, active: true, createdAt: Date.now(), ...data };
    set({ medications: [...get().medications, med], careTimezone: tz() || get().careTimezone });
    toast('Traitement ajouté', 'success');
    return med;
  },
  editMedication: (id, patch) => {
    set({ medications: get().medications.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)), careTimezone: tz() || get().careTimezone });
    toast('Traitement modifié', 'success');
  },
  deleteMedication: (id) => set({ medications: get().medications.filter((m) => m.id !== id), medLogs: get().medLogs.filter((l) => l.medId !== id) }),
  // Taken / skipped for one dose; the same status again clears it (a tap undoes a tap).
  markDose: (medId, date, time, status) => {
    const same = (l) => l.medId === medId && l.date === date && (l.time || null) === (time || null);
    const existing = get().medLogs.find(same);
    const rest = get().medLogs.filter((l) => !same(l));
    if (existing?.status === status) return set({ medLogs: rest });
    set({ medLogs: [...rest, { id: uid(), medId, date, time: time || null, status, at: Date.now() }] });
  },
  // As-needed medication: one more intake now.
  logAsNeeded: (medId, date = todayKey()) => {
    const now = new Date();
    set({ medLogs: [...get().medLogs, { id: uid(), medId, date, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, status: 'taken', asNeeded: true, at: Date.now() }] });
    toast('Prise notée', 'success');
  },
  deleteMedLog: (id) => set({ medLogs: get().medLogs.filter((l) => l.id !== id) }),
  // New box: the stock counts from today.
  refillMedication: (id, stock) => {
    set({ medications: get().medications.map((m) => (m.id === id ? { ...m, stock: Number(stock) || 0, stockDate: todayKey() } : m)) });
    toast('Stock mis à jour', 'success');
  },

  // ─────────── Medical measures ───────────
  addVital: (data) => {
    set({ vitals: [...get().vitals, { id: uid(), date: todayKey(), notes: '', createdAt: Date.now(), ...data }].sort(byDate) });
    toast('Mesure enregistrée', 'success');
  },
  editVital: (id, patch) => {
    set({ vitals: get().vitals.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v)).sort(byDate) });
    toast('Mesure modifiée', 'success');
  },
  deleteVital: (id) => set({ vitals: get().vitals.filter((v) => v.id !== id) }),

  // ─────────── Appointments & documents ───────────
  addAppointment: (data) => {
    set({ appointments: [...get().appointments, { id: uid(), done: false, notes: '', createdAt: Date.now(), ...data }], careTimezone: tz() || get().careTimezone });
    toast('Rendez-vous ajouté', 'success');
  },
  editAppointment: (id, patch) => set({ appointments: get().appointments.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)) }),
  deleteAppointment: (id) => set({ appointments: get().appointments.filter((a) => a.id !== id) }),
  addHealthDoc: (data) => {
    set({ healthDocs: [...get().healthDocs, { id: uid(), kind: 'prescription', date: todayKey(), notes: '', photo: null, nextDate: null, createdAt: Date.now(), ...data }] });
    toast('Document ajouté', 'success');
  },
  editHealthDoc: (id, patch) => set({ healthDocs: get().healthDocs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)) }),
  deleteHealthDoc: (id) => set({ healthDocs: get().healthDocs.filter((d) => d.id !== id) }),

  // ─────────── Emergency card ───────────
  setEmergencyCard: (card) => {
    set({ emergencyCard: { ...get().emergencyCard, ...card } });
    toast('Fiche d’urgence enregistrée', 'success');
  },
});
