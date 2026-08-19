// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM SCHEDULE GENERATOR — pure, deterministic greedy placement of a
// curated program's weekly blocks (cardio/training) into a user's declared
// free-time windows, respecting each program's `schedulingRules` generically
// (not hardcoded to any one program). Meals are NOT window-constrained (see
// rationale below) — they're evenly spaced clock times, not calendar blocks.
//
// Every block gets an explicit status so nothing fails silently:
//   'placed'  — fits cleanly, all rules respected
//   'shrunk'  — fits, but a soft rule (e.g. the cardio→training gap) had to
//               be relaxed to make it fit
//   'skipped' — couldn't be placed at all; surfaced as a warning, blocks the
//               calendar push for that day until resolved or explicitly
//               overridden by the caller
// ─────────────────────────────────────────────────────────────────────────────

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (min) => {
  const m = ((min % 1440) + 1440) % 1440; // wrap past midnight defensively
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
};

// First window (in given priority order) with at least `duration` minutes of
// overlap with [rangeStart, rangeEnd] — returns {start,end} in minutes, or null.
function findWindow(windows, duration, rangeStart, rangeEnd) {
  for (const w of windows) {
    const start = Math.max(w.start, rangeStart);
    const end = Math.min(w.end, rangeEnd);
    if (end - start >= duration) return { start, end: start + duration };
  }
  return null;
}

// Removes [start,end) from whichever window contains it, splitting into up
// to two remaining pieces — mutates `windows` in place.
function consume(windows, start, end) {
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    if (start >= w.start && end <= w.end) {
      const pieces = [];
      if (start - w.start > 0) pieces.push({ start: w.start, end: start });
      if (w.end - end > 0) pieces.push({ start: end, end: w.end });
      windows.splice(i, 1, ...pieces);
      return;
    }
  }
}

/**
 * @param program        curated program object (weeklyStructure/schedulingRules/sessions)
 * @param phaseKey        which weeklyStructure key to use ('phaseA'/'phaseB'/'main')
 * @param freeWindows     { [dayKey]: [{start:'HH:MM', end:'HH:MM'}] }
 * @param mealsPerDay     integer, from the active nutrition plan or a default
 * @param sleepWindow     { bedtime:'HH:MM', wakeTime:'HH:MM' } — same every day (simple, adjustable by the user)
 * @param estimateTrainingDuration (sessionKey) => minutes — caller-supplied since it
 *        needs getEffectiveExercises() from the store (variant-aware), which this pure module can't reach.
 */
export function generateProgramSchedule({ program, phaseKey, freeWindows, mealsPerDay = 3, sleepWindow, estimateTrainingDuration }) {
  const dayEntries = program.weeklyStructure[phaseKey] || program.weeklyStructure.main || [];
  const rules = program.schedulingRules || {};
  const days = {};

  for (const dayEntry of dayEntries) {
    const dayKey = dayEntry.day;
    const blocks = dayEntry.blocks || [];
    const windows = (freeWindows[dayKey] || []).map((w) => ({ start: toMin(w.start), end: toMin(w.end) })).sort((a, b) => a.start - b.start);
    const warnings = [];
    let cardio = null;
    let training = null;

    const cardioBlock = blocks.find((b) => b.type === 'cardio');
    if (cardioBlock) {
      const duration = cardioBlock.durationMin || 30;
      const wakeMin = toMin(sleepWindow.wakeTime);
      let placed = rules.fastedCardioMorning ? findWindow(windows, duration, wakeMin, wakeMin + 180) : null;
      if (!placed) placed = findWindow(windows, duration, 0, 1440);
      if (placed) {
        cardio = { status: 'placed', start: fromMin(placed.start), end: fromMin(placed.end), durationMin: duration };
        consume(windows, placed.start, placed.end);
      } else {
        cardio = { status: 'skipped', durationMin: duration, reason: cardioBlock.optional ? 'Optionnel — pas de créneau libre, ignoré.' : 'Aucun créneau libre assez long.' };
        if (!cardioBlock.optional) warnings.push({ blockType: 'cardio', code: 'no_window', message: `${dayEntry.label} : le cardio n'a pas pu être casé — ajoute un créneau libre le matin.` });
      }
    }

    const trainingBlock = blocks.find((b) => b.type === 'training');
    if (trainingBlock) {
      const duration = trainingBlock.durationMin || estimateTrainingDuration(program.id, trainingBlock.sessionKey);
      const minStart = cardio?.status === 'placed' && rules.minGapHoursCardioToTraining
        ? toMin(cardio.end) + rules.minGapHoursCardioToTraining * 60
        : 0;
      let placed = findWindow(windows, duration, minStart, 1440);
      let shrunk = false;
      if (!placed && minStart > 0) {
        placed = findWindow(windows, duration, 0, 1440);
        shrunk = true;
      }
      if (placed) {
        training = { status: shrunk ? 'shrunk' : 'placed', start: fromMin(placed.start), end: fromMin(placed.end), durationMin: duration, sessionKey: trainingBlock.sessionKey };
        if (shrunk) warnings.push({ blockType: 'training', code: 'gap_not_respected', message: `${dayEntry.label} : l'écart recommandé après le cardio (${rules.minGapHoursCardioToTraining}h) n'a pas pu être respecté avec tes créneaux actuels.` });
        consume(windows, placed.start, placed.end);
      } else {
        training = { status: 'skipped', durationMin: duration, sessionKey: trainingBlock.sessionKey, reason: 'Aucun créneau libre assez long.' };
        warnings.push({ blockType: 'training', code: 'no_window', message: `${dayEntry.label} : la séance n'a pas pu être casée — ajoute un créneau libre ou raccourcis-la.` });
      }
    }

    // Meals are reminder times, not calendar blocks — eating doesn't require
    // dedicated "free" time the way training/cardio does, so they're evenly
    // spaced across waking hours rather than window-constrained. First meal
    // anchored shortly after cardio (glycogen-reload framing already present
    // in the curated programs' own notes) when cardio was placed that day.
    const meals = [];
    if (mealsPerDay > 0) {
      const anchorStart = cardio?.status === 'placed' ? toMin(cardio.end) + 15 : toMin(sleepWindow.wakeTime) + 30;
      const dayEnd = toMin(sleepWindow.bedtime) - 60;
      const span = Math.max(0, dayEnd - anchorStart);
      const gap = mealsPerDay > 1 ? span / (mealsPerDay - 1) : 0;
      for (let i = 0; i < mealsPerDay; i++) meals.push({ time: fromMin(Math.round(anchorStart + gap * i)), label: `Repas ${i + 1}` });
      if (mealsPerDay > 1 && gap < 120) {
        warnings.push({ blockType: 'meals', code: 'tight_spacing', message: `${dayEntry.label} : repas rapprochés (moins de 2h d'écart) — journée courte entre réveil et coucher.` });
      }
    }

    days[dayKey] = { label: dayEntry.label, cardio, training, meals, warnings };
  }

  return { phaseKey, sleepWindow, mealsPerDay, days };
}
