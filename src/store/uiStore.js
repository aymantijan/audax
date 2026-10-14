import { create } from 'zustand';

let nextId = 1;

export const useUiStore = create((set) => ({
  toasts: [],
  // opts: { action: { label, onClick }, duration } — e.g. « Supprimé · Annuler ».
  addToast: (message, type = 'info', opts = {}) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action: opts.action || null }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), opts.duration || 4500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Imperative helper usable from stores/services
export const toast = (message, type = 'info', opts) => useUiStore.getState().addToast(message, type, opts);
