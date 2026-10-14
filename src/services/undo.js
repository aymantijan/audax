// « Supprimé · Annuler » everywhere (chantier 2). Wrap any deletion:
//
//   deleteWithUndo('Séance du 3 oct.', () => deleteWorkout(id));
//
// The data of every store is read just before and just after; whatever
// disappeared goes to the trash (store/trashStore.js) and a message offers
// "Annuler" for a few seconds. Restoring puts back exactly the removed records
// (utils/removals.js) — later edits elsewhere are kept.
import { DATA_STORES, storeByName } from '../store/registry';
import { useTrashStore } from '../store/trashStore';
import { toast } from '../store/uiStore';
import { findRemovals, restoreAll, recordLabel } from '../utils/removals';

const UNDO_MS = 8000;

function collect(before) {
  const stores = [];
  for (const [name, prev] of before) {
    const removals = findRemovals(prev, storeByName(name).getState());
    if (removals.length) stores.push({ name, removals });
  }
  return stores;
}

// Some deletions also take XP back (a focus session, a showcase): XP lives as
// totals + an append-only log, so the loss is measured and given back on restore.
function xpLost(before) {
  const prev = before.find(([name]) => name === 'skills')?.[1]?.skills || {};
  const now = storeByName('skills').getState().skills || {};
  const lost = {};
  for (const [id, skill] of Object.entries(prev)) {
    const d = (skill?.xp || 0) - (now[id]?.xp || 0);
    if (d > 0) lost[id] = d;
  }
  return Object.keys(lost).length ? lost : null;
}

function giveXpBack(lost) {
  const store = storeByName('skills');
  const skills = { ...store.getState().skills };
  for (const [id, amount] of Object.entries(lost)) {
    const skill = skills[id];
    if (!skill) continue;
    skills[id] = { ...skill, xp: skill.xp + amount, xpLog: [...(skill.xpLog || []), { date: Date.now(), amount, source: 'restauré' }] };
  }
  store.setState({ skills });
}

function finish(before, label) {
  const stores = collect(before);
  if (!stores.length) return null;
  const main = stores.find((s) => s.name !== 'skills') || stores[0];
  const name = label || recordLabel(main.removals[0]) || 'Élément';
  const id = useTrashStore.getState().add({ label: name, stores, xp: xpLost(before) });
  toast(`Supprimé : ${name}`, 'info', { duration: UNDO_MS, action: { label: 'Annuler', onClick: () => restoreFromTrash(id) } });
  return id;
}

export function deleteWithUndo(label, fn) {
  const before = DATA_STORES.map(({ name, store }) => [name, store.getState()]);
  const result = fn();
  if (result && typeof result.then === 'function') return result.then((r) => { finish(before, label); return r; });
  finish(before, label);
  return result;
}

export function restoreFromTrash(id, { quiet = false } = {}) {
  const entry = useTrashStore.getState().get(id);
  if (!entry) return false;
  for (const { name, removals } of entry.stores) {
    const store = storeByName(name);
    if (!store) continue;
    const prev = store.getState();
    const next = restoreAll(prev, removals);
    if (next !== prev) store.setState(next);
  }
  if (entry.xp) giveXpBack(entry.xp);
  useTrashStore.getState().remove(id);
  if (!quiet) toast(`Restauré : ${entry.label}`, 'success');
  return true;
}

export const countRecords = (entry) => entry.stores.reduce((n, s) => n + s.removals.length, 0);
