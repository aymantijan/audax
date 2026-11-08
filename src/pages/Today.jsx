import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Sunrise, HeartPulse,
  BookOpen, Flame, Sparkles, Receipt, ChevronRight, Timer, Palette,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { HABIT_CATEGORY_LABELS } from '../utils/constants';
import { useHabitStore } from '../store/habitStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useFocusStore } from '../store/focusStore';
import { useCreativeStore } from '../store/creativeStore';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { habitStreak, isHabitShownOn, streakUnit } from '../utils/calculations';
import { calculateCourseProgress } from '../utils/course-progress';
import { todayKey, fmtDate, fmtMAD } from '../utils/formatters';
import { Card, Button, Badge, EmptyState, playSeal } from '../components/common/ui';
import { NextClassBanner } from '../components/learning/Attendance';
import BriefingCard from '../components/today/BriefingCard';
import { arrangeCards } from '../utils/today-layout';
import { OrganizeButton } from '../components/today/TodayLayoutControls';
import ExamDayCard from '../components/learning/ExamDayCard';
import NudgeCard from '../components/today/NudgeCard';
import LifeReviewCard from '../components/today/LifeReviewCard';
import YesterdayCard from '../components/today/YesterdayCard';
import CareTodayCard from '../components/today/CareTodayCard';
import { CheckinModal } from '../components/habits/HabitModals';

import { useCustomCards } from '../components/today/CustomCards';
import { t, locale } from '../i18n';

const SIDE_CARD_IDS = new Set(['checkin', 'echeances', 'health', 'learning', 'focus']);
const TOP_BANNER_IDS = new Set(['exam', 'nudge', 'week', 'nextClass']);

export default function Today() {
  const user = useAuthStore((s) => s.user);
  const today = todayKey();
  const customCards = useCustomCards(); // the person's own notes and counters (J4)
  const [checkinOpen, setCheckinOpen] = useState(false);

  // ---- Habits + morning check-in ----
  const { habits, logs, energyLogs, toggleHabit } = useHabitStore();
  const dueToday = useMemo(
    () => habits.filter((h) => !h.archived && isHabitShownOn(h, logs, today)),
    [habits, logs, today]
  );
  const doneToday = dueToday.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.completed));
  const todayEnergyLog = energyLogs.find((l) => l.date === today);

  // ---- Finance: échéances due/overdue ----
  const accountingStore = useAccountingStore();
  const overdueEcheances = accountingStore.getOverdueEcheances();
  const upcomingEcheances = accountingStore.getUpcomingEcheances(3).filter(
    (e) => !overdueEcheances.some((o) => o.id === e.id && o.occurrenceDate === e.occurrenceDate)
  );

  // ---- Health ----
  const { pendingPrompts, dismissPrompt, workouts, nutritionLogs } = useHealthStore();
  const workedOutToday = workouts.some((w) => w.date === today);
  const loggedMealToday = nutritionLogs.some((n) => n.date === today);

  // ---- Concentration + création ----
  const focusStore = useFocusStore();
  const todayFocusMinutes = useMemo(() => focusStore.getTodayMinutes(today), [focusStore.sessions, today]);
  const creativeWorks = useCreativeStore((s) => s.works);
  const inProgressWorks = creativeWorks.filter((w) => w.status === 'En cours');

  // ---- Learning + reading ----
  const courses = useLearningStore((s) => s.courses);
  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active').sort((a, b) => calculateCourseProgress(a) - calculateCourseProgress(b)),
    [courses]
  );
  const focusCourse = activeCourses[0];
  const readingsStore = useReadingsStore();
  const readToday = readingsStore.readLog.some((l) => l.date === today);
  const readingStreak = readingsStore.getStreak();
  const activeBook = readingsStore.progress.find((p) => p.status === 'active');
  const activeBookInfo = activeBook ? readingsStore.library.find((b) => b.id === activeBook.bookId) : null;

  const habitsRemaining = dueToday.length - doneToday.length;
  const allHabitsDone = dueToday.length > 0 && habitsRemaining === 0;

  // Every card of the page, in the default order; the person can reorder or hide
  // them (Organiser), saved in their profile so every device shows the same page.
  const cards = [
    { id: 'briefing', label: t('Briefing du jour'), node: (
      <BriefingCard habitsDue={dueToday.length} habitsDone={doneToday.length} checkinDone={!!todayEnergyLog} />
    ) },
    { id: 'exam', label: t('Mode examen'), node: <ExamDayCard /> },
    { id: 'nudge', label: t('Suggestions de modules'), node: <NudgeCard /> },
    { id: 'week', label: t('Bilan de la semaine (dimanche et lundi)'), node: (
      <>
        {[0, 1].includes(new Date(`${today}T12:00:00`).getDay()) && <LifeReviewCard />}
      </>
    ) },
    { id: 'nextClass', label: t('Prochain cours'), node: <NextClassBanner /> },
    { id: 'care', label: t('Santé du jour'), node: <CareTodayCard /> },
    { id: 'habits', label: t('Habitudes du jour'), node: (
      <div className="space-y-4">
        <YesterdayCard />
        <Card
          title={t('Habitudes du jour')}
          action={
            <span className="inline-flex items-center rounded-full bg-surface border border-line px-2.5 py-0.5 text-xs font-semibold font-data text-ink">
              {doneToday.length}/{dueToday.length}
            </span>
          }
        >
          {dueToday.length ? (
            <ul className="space-y-2">
              {dueToday.map((h) => {
                const done = logs.some((l) => l.habitId === h.id && l.date === today && l.completed);
                const streak = habitStreak(h.id, logs, today, h);
                return (
                  <li
                    key={h.id}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      done ? 'bg-good/5 border-good/30' : 'bg-surface border-line hover:border-accent/50'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={done ? t('Décocher {name}', { name: h.name }) : t('Cocher {name}', { name: h.name })}
                      onClick={(e) => { if (!done) playSeal(e.currentTarget); toggleHabit(h.id, today); }}
                      className="ui-icon-btn shrink-0 rounded-full flex items-center justify-center cursor-pointer text-accent"
                    >
                      {done ? <CheckCircle2 size={20} className="text-good" /> : <Circle size={20} className="text-mute" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${done ? 'line-through text-mute' : 'text-ink'}`}>{h.name}</div>
                      <div className="text-xs text-mute truncate">
                        {t(HABIT_CATEGORY_LABELS[h.category] || h.category)}
                        {h.mandatory ? ` · ${t('prioritaire')}` : ''}
                        {h.kind === 'quantity' ? ` · ${Number(logs.find((l) => l.habitId === h.id && l.date === today)?.value) || 0}/${h.target} ${h.unit || ''}${h.source ? ' (auto)' : ''}` : ''}
                      </div>
                    </div>
                    {streak > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-card border border-line px-2 py-0.5 text-xs font-data text-mute shrink-0">
                        <Flame size={12} className={streak >= 3 ? 'text-warn' : 'text-mute'} />
                        {streak} {t(streakUnit(h))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>{t('Aucune habitude programmée aujourd’hui.')}</EmptyState>
          )}
          {allHabitsDone && (
            <div className="mt-3 flex items-center gap-2 text-sm text-good">
              <Sparkles size={15} /> {t('Tout est fait — protège ta série demain.')}
            </div>
          )}
        </Card>
      </div>
    ) },
    { id: 'checkin', label: t('Check-in du matin'), node: (
      <Card title={t('Check-in du matin')}>
        {todayEnergyLog ? (
          <button
            type="button"
            onClick={() => setCheckinOpen(true)}
            className="w-full grid grid-cols-3 gap-3 text-left rounded-xl bg-surface border border-line p-3 hover:border-accent transition-colors cursor-pointer"
          >
            <div>
              <div className="text-mute text-xs">{t('Énergie')}</div>
              <div className="text-lg font-bold font-data">{todayEnergyLog.energyStartLevel}/10</div>
            </div>
            <div>
              <div className="text-mute text-xs">{t('Sommeil')}</div>
              <div className="text-lg font-bold font-data">{todayEnergyLog.sleepData?.sleepQualityScore ?? '—'}/10</div>
            </div>
            <div>
              <div className="text-mute text-xs">{t('Stress')}</div>
              <div className="text-lg font-bold font-data">{todayEnergyLog.stressLevel}/10</div>
            </div>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-mute">
              <Sunrise size={16} className="text-accent shrink-0" /> {t('Pas encore fait aujourd’hui.')}
            </div>
            <Button className="!px-3 !py-1.5 text-xs shrink-0" onClick={() => setCheckinOpen(true)}>
              {t('Faire le check-in')}
            </Button>
          </div>
        )}
      </Card>
    ) },
    { id: 'echeances', label: t('Échéances'), node: (
      <>
        {(overdueEcheances.length > 0 || upcomingEcheances.length > 0) && (
          <Card title={t('Échéances')}>
            <ul className="space-y-2">
              {overdueEcheances.map((e) => (
                <EcheanceRow key={`${e.id}-${e.occurrenceDate}`} e={e} overdue accountingStore={accountingStore} />
              ))}
              {upcomingEcheances.map((e) => (
                <EcheanceRow key={`${e.id}-${e.occurrenceDate}`} e={e} accountingStore={accountingStore} />
              ))}
            </ul>
          </Card>
        )}
      </>
    ) },
    { id: 'health', label: t('Santé'), node: (
      <Card
        title={t('Santé')}
        action={
          <Link to="/health" className="text-xs text-accent hover:underline flex items-center gap-1">
            {t('Ouvrir')} <ChevronRight size={12} />
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <Link
            to="/health?tab=gym"
            className="flex items-center gap-2 rounded-xl bg-surface border border-line px-3 py-2.5 hover:border-accent transition-colors"
          >
            <HeartPulse size={16} className={workedOutToday ? 'text-good shrink-0' : 'text-mute shrink-0'} />
            <span className={`text-xs font-medium truncate ${workedOutToday ? 'text-ink' : 'text-mute'}`}>
              {workedOutToday ? t('Séance enregistrée') : t('Pas de séance')}
            </span>
          </Link>
          <Link
            to="/health?tab=nutrition"
            className="flex items-center gap-2 rounded-xl bg-surface border border-line px-3 py-2.5 hover:border-accent transition-colors"
          >
            <Receipt size={16} className={loggedMealToday ? 'text-good shrink-0' : 'text-mute shrink-0'} />
            <span className={`text-xs font-medium truncate ${loggedMealToday ? 'text-ink' : 'text-mute'}`}>
              {loggedMealToday ? t('Repas enregistré') : t('Aucun repas enregistré')}
            </span>
          </Link>
        </div>
        {pendingPrompts.length > 0 && (
          <ul className="mt-3 space-y-2">
            {pendingPrompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 bg-surface border border-line rounded-xl px-3 py-2 text-sm">
                <span>{t('Enregistrer « {name} » comme activité santé ?', { name: p.habitName })}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link to="/health">
                    <Button className="!px-2.5 !py-1 text-xs">{t('Enregistrer')}</Button>
                  </Link>
                  <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => dismissPrompt(p.id)}>
                    {t('Ignorer')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ) },
    { id: 'focus', label: t('Concentration et création'), node: (
      <>
        {(() => {
          const focusOn = user?.enabledModules?.focus ?? false;
          const creativeOn = user?.enabledModules?.creative ?? false;
          const showFocus = focusOn && focusStore.sessions.length > 0;
          const showCreative = creativeOn && creativeWorks.length > 0;
          if (!showFocus && !showCreative) return null;
          return (
            <Card title={t('Concentration et création')}>
              <div className="flex items-center gap-6 text-sm flex-wrap">
                {showFocus && (
                  <Link to="/focus" className="flex items-center gap-1.5 hover:text-accent">
                    <Timer size={15} className="text-mute" />
                    <span>{todayFocusMinutes > 0 ? t('{n} min aujourd’hui', { n: todayFocusMinutes }) : t('Aucune session aujourd’hui')}</span>
                  </Link>
                )}
                {showCreative && (
                  <Link to="/creative" className="flex items-center gap-1.5 hover:text-accent">
                    <Palette size={15} className="text-mute" />
                    <span>{inProgressWorks.length === 1 ? t('1 œuvre en cours') : t('{n} œuvres en cours', { n: inProgressWorks.length })}</span>
                  </Link>
                )}
              </div>
            </Card>
          );
        })()}
      </>
    ) },
    { id: 'learning', label: t('Études et lecture'), node: (
      <>
        {(focusCourse || activeBookInfo || readingsStore.progress.length > 0) && (
          <Card title={t('Apprentissage & lecture')}>
            <div className="space-y-2.5">
              {focusCourse && (
                <Link
                  to={`/learning/course/${focusCourse.id}`}
                  className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-2.5 hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen size={15} className="text-mute shrink-0" />
                    <span className="text-sm truncate">{focusCourse.name}</span>
                  </div>
                  <Badge color="var(--accent-primary)">{Math.round(calculateCourseProgress(focusCourse))}%</Badge>
                </Link>
              )}
              {activeBookInfo && (
                <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen size={15} className="text-mute shrink-0" />
                    <span className="text-sm truncate">{activeBookInfo.title}</span>
                  </div>
                  {!readToday ? (
                    <Link to="/learning/readings" className="text-xs text-accent hover:underline shrink-0">
                      {t('Lire aujourd’hui')}
                    </Link>
                  ) : (
                    <span className="text-xs text-good shrink-0 flex items-center gap-1">
                      <Flame size={12} /> {t('série {n} j', { n: readingStreak })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </>
    ) },
    ...customCards,
  ];

  const ordered = arrangeCards(cards, user?.todayLayout);
  const topCards = ordered.filter((c) => TOP_BANNER_IDS.has(c.id));
  const mainCards = ordered.filter((c) => !TOP_BANNER_IDS.has(c.id) && !SIDE_CARD_IDS.has(c.id));
  const sideCards = ordered.filter((c) => SIDE_CARD_IDS.has(c.id));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Bonjour, {name}', { name: user?.name })}</h1>
          <p className="text-mute text-sm mt-1">
            {(() => {
              const d = new Date(`${today}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              return d.charAt(0).toUpperCase() + d.slice(1);
            })()} — {t('ce qu’il te reste à faire aujourd’hui.')}
          </p>
        </div>
        <OrganizeButton cards={cards} />
      </div>

      {topCards.map((c) => <Fragment key={c.id}>{c.node}</Fragment>)}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {mainCards.map((c) => <Fragment key={c.id}>{c.node}</Fragment>)}
        </div>
        <div className="lg:col-span-5 space-y-5">
          {sideCards.map((c) => <Fragment key={c.id}>{c.node}</Fragment>)}
        </div>
      </div>

      <CheckinModal open={checkinOpen} onClose={() => setCheckinOpen(false)} date={today} />
    </div>
  );
}

function EcheanceRow({ e, overdue, accountingStore }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border ${overdue ? 'bg-bad/10 border-bad/30' : 'bg-surface border-line'}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{e.label}</div>
        <div className={`text-xs ${overdue ? 'text-bad' : 'text-mute'}`}>
          {overdue ? `${t('En retard')} — ` : ''}
          {fmtDate(e.occurrenceDate)} · {e.type === 'produit' ? '+' : '-'}{fmtMAD(e.amount)}
        </div>
      </div>
      <Button
        className="!px-2.5 !py-1 text-xs shrink-0"
        onClick={() => accountingStore.markEcheancePaid(e.id, e.occurrenceDate)}
      >
        {t('Marquer payé')}
      </Button>
    </li>
  );
}
