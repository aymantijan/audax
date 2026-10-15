// Morning briefing (étape 5): the few things that matter today, most urgent
// first, each with where to act. Computed locally — no AI needed; the
// assistant can give a longer commented version on request.
// Pure: tested in tests/briefing.test.mjs.
import { classesOn } from './attendance.js';
import { upcomingEvaluations, daysUntil } from './academic.js';
import { t } from '../i18n/index.js';

// One sentence per number form, so every language can word it its own way.
const tn = (n, one, many, vars = {}) => t(n > 1 ? many : one, { n, ...vars });

export function buildBriefing({
  today, nowMs = Date.now(), courses = [], academic = null, habitsDue = 0, habitsDone = 0,
  overdueEcheances = [], todayEcheances = [], flashcardsDue = 0, checkinDone = true, weekObjectivesLeft = 0,
}) {
  const items = [];

  const overdue = overdueEcheances.length;
  if (overdue) items.push({ key: 'overdue', level: 'urgent', text: tn(overdue, '{n} paiement en retard à régler ou à reporter.', '{n} paiements en retard à régler ou à reporter.'), to: '/finance?tab=echeances' });

  const soon = upcomingEvaluations(courses, today).filter((x) => !x.past && daysUntil(x.ev.date, today) <= 7);
  for (const x of soon.slice(0, 3)) {
    const d = daysUntil(x.ev.date, today);
    const vars = { name: x.ev.name || t('Évaluation'), course: x.course.name, d };
    const text = d === 0 ? t('{name} de {course} aujourd’hui.', vars) : d === 1 ? t('{name} de {course} demain.', vars) : t('{name} de {course} dans {d} jours.', vars);
    items.push({ key: `eval-${x.course.id}-${x.ev.id || x.ev.name}`, level: d <= 1 ? 'urgent' : 'today', text, to: '/learning?tab=exams' });
  }

  if (academic) {
    const classes = classesOn(courses, academic, today).filter((o) => o.endMs > nowMs);
    if (classes.length) {
      const first = classes[0];
      items.push({ key: 'classes', level: 'today', text: tn(classes.length, '{n} cours encore aujourd’hui, le prochain : {course} à {time}.', '{n} cours encore aujourd’hui, le prochain : {course} à {time}.', { course: first.course.name, time: first.start }), to: '/learning?tab=timetable' });
    }
  }

  if (todayEcheances.length) items.push({ key: 'due-today', level: 'today', text: tn(todayEcheances.length, '{n} paiement prévu aujourd’hui.', '{n} paiements prévus aujourd’hui.'), to: '/finance?tab=echeances' });

  const left = Math.max(0, habitsDue - habitsDone);
  if (habitsDue) items.push({ key: 'habits', level: left ? 'today' : 'done', text: left ? tn(left, '{n} habitude à cocher sur {total}.', '{n} habitudes à cocher sur {total}.', { total: habitsDue }) : t('Toutes tes habitudes du jour sont faites.'), to: '/habits' });

  if (weekObjectivesLeft) items.push({ key: 'week-goals', level: 'today', text: tn(weekObjectivesLeft, '{n} objectif de la semaine encore ouvert.', '{n} objectifs de la semaine encore ouverts.'), to: '/goals' });
  if (!checkinDone) items.push({ key: 'checkin', level: 'today', text: t('Ton check-in du matin (énergie, sommeil) n’est pas fait.'), to: '/habits?checkin=1' });
  if (flashcardsDue) items.push({ key: 'cards', level: 'info', text: tn(flashcardsDue, '{n} fiche à réviser.', '{n} fiches à réviser.'), to: '/learning?tab=review' });

  const order = { urgent: 0, today: 1, info: 2, done: 3 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
