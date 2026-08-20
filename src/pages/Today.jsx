import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Sunrise, TrendingUp, TrendingDown, Wallet, HeartPulse,
  BookOpen, ArrowRight, AlertTriangle, Flame, Sparkles, Receipt, ChevronRight, FlaskConical,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useHabitStore } from '../store/habitStore';
import { useTradingStore } from '../store/tradingStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { useEngineeringStore } from '../store/engineeringStore';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { isHabitDueOn, habitStreak } from '../utils/calculations';
import { ENGINEERING_PROJECT_STAGES } from '../utils/constants';
import { calculateCourseProgress } from '../utils/course-progress';
import { todayKey, fmtDate, fmtMoney, fmtSignedMoney, fmtMAD } from '../utils/formatters';
import { Card, Button, Badge, EmptyState } from '../components/common/ui';

export default function Today() {
  const user = useAuthStore((s) => s.user);
  const today = todayKey();

  // ---- Habits + morning check-in (raw slices only — see the Zustand
  // useSyncExternalStore infinite-loop note in project memory: never select a
  // store getter that allocates a fresh array/object inline). ----
  const { habits, logs, energyLogs, toggleHabit } = useHabitStore();
  const dueToday = useMemo(
    () => habits.filter((h) => !h.archived && isHabitDueOn(h, today) && h.startDate <= today),
    [habits, today]
  );
  const doneToday = dueToday.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.completed));
  const todayEnergyLog = energyLogs.find((l) => l.date === today);

  // ---- Trading ----
  const tradingStore = useTradingStore();
  const activeAccountId = tradingStore.activeAccountId;
  const activeAccount = tradingStore.getAccount(activeAccountId);
  const acctTrades = tradingStore.getAccountTrades(activeAccountId);
  const tradesToday = acctTrades.filter((t) => t.date === today);
  const currency = activeAccount?.currency || 'USD';
  const accountValue = tradingStore.accountValue(activeAccountId);
  const monthStats = tradingStore.getMonthStats(activeAccountId);
  const unjournaledToday = tradesToday.filter((t) => !t.journal?.reasoning).length;
  const riskBreaches =
    activeAccount?.type === 'propfirm'
      ? tradingStore.getPropFirmProgress(activeAccountId)?.breaches?.length || 0
      : tradingStore.getRiskLimitBreaches(activeAccountId)?.length || 0;

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

  // ---- Engineering ----
  const { labEntries, projects: engProjects } = useEngineeringStore();
  const loggedLabToday = labEntries.some((e) => e.date === today);
  const activeEngProjects = engProjects.filter((p) => !(p.stageIndex === ENGINEERING_PROJECT_STAGES.length - 1 && p.stageStatus === 'done'));

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {user?.name}</h1>
          <p className="text-mute text-sm mt-1">{fmtDate(today)} — ce qu'il te reste à faire aujourd'hui.</p>
        </div>
        <Link to="/dashboard" className="text-sm text-accent hover:underline flex items-center gap-1 shrink-0">
          Tableau de bord complet <ArrowRight size={14} />
        </Link>
      </div>

      {/* ---- Habits: the primary daily checklist ---- */}
      <Card
        title="Habitudes du jour"
        action={<span className="text-xs text-mute">{doneToday.length}/{dueToday.length}</span>}
      >
        {dueToday.length ? (
          <ul className="space-y-2">
            {dueToday.map((h) => {
              const done = logs.some((l) => l.habitId === h.id && l.date === today && l.completed);
              const streak = habitStreak(h.id, logs, today, h);
              return (
                <li key={h.id} className="flex items-center gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
                  <button onClick={() => toggleHabit(h.id, today)} className="shrink-0 cursor-pointer text-accent">
                    {done ? <CheckCircle2 size={19} /> : <Circle size={19} className="text-mute" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${done ? 'line-through text-mute' : ''}`}>{h.name}</div>
                    <div className="text-[11px] text-mute">
                      {h.category}
                      {h.mandatory ? ' · obligatoire' : ''}
                      {streak > 0 ? ` · série ${streak}j` : ''}
                    </div>
                  </div>
                  {streak >= 3 && <Flame size={14} className="text-warn shrink-0" />}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Aucune habitude programmée aujourd'hui.</EmptyState>
        )}
        {allHabitsDone && (
          <div className="mt-3 flex items-center gap-2 text-sm text-good">
            <Sparkles size={15} /> Tout est fait — protège ta série demain.
          </div>
        )}
      </Card>

      {/* ---- Morning check-in ---- */}
      <Card title="Check-in du matin">
        {todayEnergyLog ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-mute text-xs">Énergie</div>
              <div className="text-lg font-semibold">{todayEnergyLog.energyStartLevel}/10</div>
            </div>
            <div>
              <div className="text-mute text-xs">Sommeil</div>
              <div className="text-lg font-semibold">{todayEnergyLog.sleepData?.sleepQualityScore ?? '—'}/10</div>
            </div>
            <div>
              <div className="text-mute text-xs">Stress</div>
              <div className="text-lg font-semibold">{todayEnergyLog.stressLevel}/10</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-mute">
              <Sunrise size={16} /> Pas encore loggé aujourd'hui.
            </div>
            <Link to="/habits">
              <Button className="!px-3 !py-1.5 text-xs">Faire le check-in</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* ---- Trading ---- */}
      <Card
        title="Trading"
        action={
          <Link to="/trading" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ouvrir <ChevronRight size={12} />
          </Link>
        }
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Wallet size={16} className="text-mute" />
            <span className="text-ink font-medium">{activeAccount?.name || 'Aucun compte'}</span>
            <span className="text-mute">{fmtMoney(accountValue, 0, currency)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            {monthStats.totalPnl >= 0 ? <TrendingUp size={15} className="text-good" /> : <TrendingDown size={15} className="text-bad" />}
            <span className={monthStats.totalPnl >= 0 ? 'text-good' : 'text-bad'}>{fmtSignedMoney(monthStats.totalPnl, currency)}</span>
            <span className="text-mute text-xs">ce mois</span>
          </div>
          <div className="text-sm text-mute">{tradesToday.length} trade{tradesToday.length !== 1 ? 's' : ''} aujourd'hui</div>
        </div>
        {(unjournaledToday > 0 || riskBreaches > 0) && (
          <div className="mt-3 space-y-1.5">
            {riskBreaches > 0 && (
              <div className="flex items-center gap-2 text-xs text-bad">
                <AlertTriangle size={13} /> {riskBreaches} règle{riskBreaches !== 1 ? 's' : ''} de risque en dépassement — vérifie ton compte.
              </div>
            )}
            {unjournaledToday > 0 && (
              <div className="flex items-center gap-2 text-xs text-warn">
                <AlertTriangle size={13} /> {unjournaledToday} trade{unjournaledToday !== 1 ? 's' : ''} du jour sans journal.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---- Finance: échéances ---- */}
      {(overdueEcheances.length > 0 || upcomingEcheances.length > 0) && (
        <Card title="Échéances">
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

      {/* ---- Health ---- */}
      <Card
        title="Santé"
        action={
          <Link to="/health" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ouvrir <ChevronRight size={12} />
          </Link>
        }
      >
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <HeartPulse size={15} className={workedOutToday ? 'text-good' : 'text-mute'} />
            <span className={workedOutToday ? 'text-ink' : 'text-mute'}>{workedOutToday ? 'Séance loggée' : 'Pas de séance'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Receipt size={15} className={loggedMealToday ? 'text-good' : 'text-mute'} />
            <span className={loggedMealToday ? 'text-ink' : 'text-mute'}>{loggedMealToday ? 'Repas loggé' : 'Aucun repas loggé'}</span>
          </div>
        </div>
        {pendingPrompts.length > 0 && (
          <ul className="mt-3 space-y-2">
            {pendingPrompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 bg-surface border border-line rounded-lg px-3 py-2 text-sm">
                <span>Logger « {p.habitName} » comme activité santé ?</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link to="/health">
                    <Button className="!px-2.5 !py-1 text-xs">Logger</Button>
                  </Link>
                  <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => dismissPrompt(p.id)}>
                    Ignorer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---- Engineering ---- */}
      {(user?.enabledModules?.engineering ?? false) && (
        <Card
          title="Ingénierie"
          action={
            <Link to="/engineering" className="text-xs text-accent hover:underline flex items-center gap-1">
              Ouvrir <ChevronRight size={12} />
            </Link>
          }
        >
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <FlaskConical size={15} className={loggedLabToday ? 'text-good' : 'text-mute'} />
              <span className={loggedLabToday ? 'text-ink' : 'text-mute'}>{loggedLabToday ? 'Expérience loggée' : 'Aucune expérience loggée'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-mute">{activeEngProjects.length} projet{activeEngProjects.length !== 1 ? 's' : ''} en cours</span>
            </div>
          </div>
          {activeEngProjects.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {activeEngProjects.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm bg-surface border border-line rounded-lg px-3 py-2">
                  <Link to={`/engineering/${p.id}`} className="hover:text-accent">{p.name}</Link>
                  <span className="text-xs text-mute">{ENGINEERING_PROJECT_STAGES[p.stageIndex]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ---- Learning & reading ---- */}
      {(focusCourse || activeBookInfo || readingsStore.progress.length > 0) && (
        <Card title="Apprentissage & lecture">
          <div className="space-y-3">
            {focusCourse && (
              <Link
                to={`/learning/course/${focusCourse.id}`}
                className="flex items-center justify-between gap-3 bg-surface border border-line rounded-lg px-4 py-2.5 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={15} className="text-mute shrink-0" />
                  <span className="text-sm truncate">{focusCourse.name}</span>
                </div>
                <Badge color="var(--accent-primary)">{Math.round(calculateCourseProgress(focusCourse))}%</Badge>
              </Link>
            )}
            {activeBookInfo && (
              <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={15} className="text-mute shrink-0" />
                  <span className="text-sm truncate">{activeBookInfo.title}</span>
                </div>
                {!readToday ? (
                  <Link to="/learning/readings" className="text-xs text-accent hover:underline shrink-0">
                    Lire aujourd'hui
                  </Link>
                ) : (
                  <span className="text-xs text-good shrink-0 flex items-center gap-1">
                    <Flame size={12} /> série {readingStreak}j
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function EcheanceRow({ e, overdue, accountingStore }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 border ${overdue ? 'bg-bad/10 border-bad/30' : 'bg-surface border-line'}`}>
      <div className="min-w-0">
        <div className="text-sm truncate">{e.label}</div>
        <div className={`text-[11px] ${overdue ? 'text-bad' : 'text-mute'}`}>
          {overdue ? 'En retard — ' : ''}
          {fmtDate(e.occurrenceDate)} · {e.type === 'produit' ? '+' : '-'}{fmtMAD(e.amount)}
        </div>
      </div>
      <Button
        className="!px-2.5 !py-1 text-xs shrink-0"
        onClick={() => accountingStore.markEcheancePaid(e.id, e.occurrenceDate)}
      >
        Marquer payé
      </Button>
    </li>
  );
}
