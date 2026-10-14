// Stable colour per subject so it reads the same across the grid and lists.
// Its own tiny module (G9): the always-loaded timer dock needs it, and
// importing it from TimetableView pulled the timetable + attendance screens
// into the startup bundle.
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16', '#3b82f6', '#f97316'];
export const courseColor = (id = '') => PALETTE[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
