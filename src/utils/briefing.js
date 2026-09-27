// Morning briefing (étape 5): the few things that matter today, most urgent
// first, each with where to act. Computed locally — no AI needed; the
// assistant can give a longer commented version on request.
// Pure: tested in tests/briefing.test.mjs.
import { classesOn } from './attendance.js';
import { upcomingEvaluations, daysUntil } from './academic.js';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function buildBriefing({
  today, nowMs = Date.now(), courses = [], academic = null, habitsDue = 0, habitsDone = 0,
  overdueEcheances = [], todayEcheances = [], flashcardsDue = 0, followUps = 0, checkinDone = true,
}) {
  const items = [];

  const overdue = overdueEcheances.length;
  if (overdue) items.push({ key: 'overdue', level: 'urgent', text: `${plural(overdue, 'paiement en retard', 'paiements en retard')} à régler ou à reporter.`, to: '/finance?tab=echeances' });

  const soon = upcomingEvaluations(courses, today).filter((x) => !x.past && daysUntil(x.ev.date, today) <= 7);
  for (const x of soon.slice(0, 3)) {
    const d = daysUntil(x.ev.date, today);
    const when = d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} jours`;
    items.push({ key: `eval-${x.course.id}-${x.ev.id || x.ev.name}`, level: d <= 1 ? 'urgent' : 'today', text: `${x.ev.name || 'Évaluation'} de ${x.course.name} ${when}.`, to: '/learning?tab=exams' });
  }

  if (academic) {
    const classes = classesOn(courses, academic, today).filter((o) => o.endMs > nowMs);
    if (classes.length) {
      const first = classes[0];
      items.push({ key: 'classes', level: 'today', text: `${plural(classes.length, 'cours', 'cours')} encore aujourd’hui, le prochain : ${first.course.name} à ${first.start}.`, to: '/learning?tab=timetable' });
    }
  }

  if (todayEcheances.length) items.push({ key: 'due-today', level: 'today', text: `${plural(todayEcheances.length, 'paiement prévu', 'paiements prévus')} aujourd’hui.`, to: '/finance?tab=echeances' });

  const left = Math.max(0, habitsDue - habitsDone);
  if (habitsDue) items.push({ key: 'habits', level: left ? 'today' : 'done', text: left ? `${plural(left, 'habitude', 'habitudes')} à cocher sur ${habitsDue}.` : 'Toutes tes habitudes du jour sont faites.', to: '/habits' });

  if (!checkinDone) items.push({ key: 'checkin', level: 'today', text: 'Ton check-in du matin (énergie, sommeil) n’est pas fait.', to: '/habits?checkin=1' });
  if (flashcardsDue) items.push({ key: 'cards', level: 'info', text: `${plural(flashcardsDue, 'fiche', 'fiches')} à réviser.`, to: '/learning?tab=review' });
  if (followUps) items.push({ key: 'followups', level: 'info', text: `${plural(followUps, 'contact', 'contacts')} à relancer.`, to: '/career?tab=reseau' });

  const order = { urgent: 0, today: 1, info: 2, done: 3 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
