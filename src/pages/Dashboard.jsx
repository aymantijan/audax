import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, CheckCircle2, Info, ArrowRight, Flame, Award, Rocket } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { gradeFor } from '../utils/grades';
import { useAuthStore } from '../store/authStore';
import { useTradingStore } from '../store/tradingStore';
import { useLearningStore } from '../store/learningStore';
import { useAllGoals } from '../hooks/useAllGoals';
import { useAccountingStore } from '../store/accountingStore';
import { useHabitStore } from '../store/habitStore';
import { useSkillStore } from '../store/skillStore';
import { useDealsStore } from '../store/dealsStore';
import { useBusinessStore } from '../store/businessStore';
import { useEngineeringStore } from '../store/engineeringStore';
import { useNetworkingStore } from '../store/networkingStore';
import { useCareerStore } from '../store/careerStore';
import { useContentStore } from '../store/contentStore';
import { useFocusStore } from '../store/focusStore';
import { useFundraisingStore } from '../store/fundraisingStore';
import { useFreelanceStore } from '../store/freelanceStore';
import { useCreativeStore } from '../store/creativeStore';
import { useRealEstateStore } from '../store/realEstateStore';
import { useReadingsStore } from '../store/readingsStore';
import { useSynergy } from '../hooks/useSynergy';
import { synergyColor } from '../utils/synergy';
import { habitCompliance, weightedGPA, habitStreak, tradeStats } from '../utils/calculations';
import { checkBurnoutTriggers } from '../utils/burnout';
import { buildObservations } from '../utils/observations';
import { calculateCourseProgress } from '../utils/course-progress';
import { GRADE_POINTS, SKILL_MAP, LEVEL_NAMES } from '../utils/constants';
import { fmtMoney, fmtSignedMoney, fmtMAD, fmtPct, fmtDate, todayKey } from '../utils/formatters';
import { Card, Stat, Badge, EmptyState } from '../components/common/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AccountSwitcher from '../components/common/AccountSwitcher';
import { startOfMonth } from 'date-fns';

export default function Dashboard() {
  const [demoOpen, setDemoOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  // Same bug class as synergy.js's trading gate: this page never checked
  // enabledModules at all, so a user who opted OUT of Trading/Deals during
  // onboarding still saw the account switcher, Account value/Month P&L
  // stats, the equity curve, and a "Deals" life-balance bar for modules
  // they explicitly turned off.
  const tradingEnabled = user?.enabledModules?.trading ?? true;
  const peEnabled = user?.enabledModules?.pe ?? true;
  const businessEnabled = user?.enabledModules?.business ?? true;
  const engineeringEnabled = user?.enabledModules?.engineering ?? false;
  const networkingEnabled = user?.enabledModules?.networking ?? false;
  const careerEnabled = user?.enabledModules?.career ?? false;
  const contentEnabled = user?.enabledModules?.content ?? false;
  const focusEnabled = user?.enabledModules?.focus ?? false;
  const fundraisingEnabled = user?.enabledModules?.fundraising ?? false;
  const freelanceEnabled = user?.enabledModules?.freelance ?? false;
  const creativeEnabled = user?.enabledModules?.creative ?? false;
  const realEstateEnabled = user?.enabledModules?.realEstate ?? false;
  const trades = useTradingStore((s) => s.trades);
  const tradingStore = useTradingStore();
  const courses = useLearningStore((s) => s.courses);
  const skills = useSkillStore((s) => s.skills);
  const deals = useDealsStore((s) => s.deals);
  const businesses = useBusinessStore((s) => s.businesses);
  const labEntries = useEngineeringStore((s) => s.labEntries);
  const engProjects = useEngineeringStore((s) => s.projects);
  const contacts = useNetworkingStore((s) => s.contacts);
  const applications = useCareerStore((s) => s.applications);
  const posts = useContentStore((s) => s.posts);
  const focusSessions = useFocusStore((s) => s.sessions);
  const investors = useFundraisingStore((s) => s.investors);
  const engagements = useFreelanceStore((s) => s.engagements);
  const creativeWorks = useCreativeStore((s) => s.works);
  const properties = useRealEstateStore((s) => s.properties);
  const readingsStore = useReadingsStore();
  const { habits, logs, energyLogs } = useHabitStore();
  const synergy = useSynergy();

  const PE_TRACKS = ['PE', 'GE', 'VC', 'RBF'];
  const peSkillsUnlocked = Object.values(skills).filter((s) => !s.locked && PE_TRACKS.includes(SKILL_MAP[s.id]?.track)).length;
  const peSkillsTotal = Object.values(skills).filter((s) => PE_TRACKS.includes(SKILL_MAP[s.id]?.track)).length;
  const dealSize = deals.reduce((a, d) => a + (d.size || 0), 0);

  const readingRows = useMemo(
    () => readingsStore.progress.map((p) => ({ ...p, totalPages: readingsStore.totalPagesFor(p) })),
    [readingsStore.progress, readingsStore.library]
  );
  const readingStreak = readingsStore.getStreak();
  const totalPagesRead = readingRows.reduce((a, r) => a + r.pagesRead, 0);

  const today = todayKey();
  const activeAccountId = tradingStore.activeAccountId;
  const activeAccountObj = tradingStore.getAccount(activeAccountId);
  const acctTrades = tradingStore.getAccountTrades(activeAccountId);
  const monthTrades = acctTrades.filter((t) => new Date(t.date) >= startOfMonth(new Date()));
  const monthStats = tradingStore.getMonthStats(activeAccountId);
  const account = tradingStore.accountValue(activeAccountId);

  // Demo accounts are aggregated (any number of them) and shown as a secondary
  // breakdown whenever the account currently being viewed is NOT itself a demo.
  const demoAccounts = tradingStore.getAccountsByType('demo').filter((a) => a.status !== 'archived');
  const hasNonDemo = tradingStore.accounts.some((a) => a.type !== 'demo' && a.status !== 'archived');
  const demoTrades = demoAccounts.flatMap((a) => tradingStore.getAccountTrades(a.id));
  const demoStats = tradeStats(demoTrades);
  const demoAccount = demoAccounts.reduce((a, acc) => a + tradingStore.accountValue(acc.id), 0);
  const gpa = weightedGPA(courses, GRADE_POINTS);
  // Automatic net worth: Actif Net Comptable Corrigé from the double-entry journal
  // (ANC = Actif − Dettes, then + plus-values − moins-values). No manual snapshot.
  const accountingStore = useAccountingStore();
  const hasJournal = accountingStore.journal.length > 0;
  const netWorth = hasJournal ? accountingStore.getNetWorth().ancc : null;
  // Real goals (treasury/net-worth targets), not the legacy financeStore ones —
  // Finance > Goals writes to accountingStore.goals exclusively, so reading the
  // old store here would show stale/dead goals instead of what the user actually set.
  // Not gated on hasJournal: a goal can be created before any journal entry exists
  // (getGoalRows() handles an empty journal fine, just with current=0/no pace yet).
  const goals = accountingStore.getGoalRows();
  const allGoals = useAllGoals();
  const todayEnergy = energyLogs.find((l) => l.date === today);

  // Grade (game rank) from raw lifetime XP (not the domain-balanced figure —
  // user explicitly rejected the diminishing-returns mechanic: it made a
  // large, real XP total look "stuck" behind an invisible, harder-to-read
  // number) + synergy score.
  const lifetimeXP = useSkillStore((s) => s.getLifetimeXP());
  const grade = gradeFor(lifetimeXP, synergy.weighted);
  const equityCurve = useMemo(
    () => tradingStore.getEquityCurve(activeAccountId).map((p, i) => ({ i, value: p.value })),
    [acctTrades, activeAccountId]
  );
  const lifeBalance = [
    { label: 'Compétences', value: Math.round((Object.values(skills).filter((s) => !s.locked).length / Object.values(skills).length) * 100), sub: `${Object.values(skills).filter((s) => !s.locked).length}/${Object.values(skills).length} débloquées`, color: 'var(--accent-primary)' },
    { label: 'Cours', value: courses.length ? Math.round((courses.filter((c) => c.status === 'completed').length / courses.length) * 100) : 0, sub: `${courses.filter((c) => c.status === 'completed').length}/${courses.length} terminés`, color: 'var(--accent-secondary)' },
    { label: 'Lecture', value: readingRows.length ? Math.round((readingRows.filter((r) => r.status === 'completed').length / readingRows.length) * 100) : 0, sub: `${totalPagesRead.toLocaleString('fr-FR')} pages · série de ${readingStreak} j`, color: 'var(--warning)' },
    ...(peEnabled ? [{ label: 'Private equity', value: Math.min(100, deals.length * 20), sub: deals.length ? fmtMoney(dealSize) + ' au total' : 'suivi PE / VC', color: 'var(--success)' }] : []),
    // Business Projects (2026-09-01: now includes tier: 'leger' side-projects,
    // formerly the standalone Projects domain — see businessStore.js) — done
    // phases (formal tier) + done tasks (either tier) both count as progress.
    ...(businessEnabled ? [{ label: 'Business', value: Math.min(100, (businesses.reduce((a, b) => a + b.phases.filter((p) => p.status === 'done').length, 0) + businesses.reduce((a, b) => a + (b.tasks || []).filter((t) => t.status === 'done').length, 0)) * 10), sub: businesses.length ? `${businesses.length} suivi${businesses.length > 1 ? 's' : ''}` : 'suivi de A à Z', color: 'var(--accent-secondary)' }] : []),
    // Reuses the already-computed synergy.subScores.engineering (this month's lab
    // + project-task activity, see synergy.js#engineeringScore) rather than a
    // separate ad-hoc formula — Skills/Courses/Reading/Deals/Business is the
    // only curated "highlights" row on Dashboard that didn't include
    // Engineering despite it having its own gate, badges, and synergy domain.
    ...(engineeringEnabled ? [{ label: 'Ingénierie', value: synergy.subScores.engineering ?? 0, sub: `${labEntries.length} labo · ${engProjects.length} projet${engProjects.length !== 1 ? 's' : ''}`, color: 'var(--warning)' }] : []),
    // Networking/Career/Content (2026-08-27) — same pattern: reuse
    // the already-computed synergy score rather than a separate formula.
    ...(networkingEnabled && contacts.length ? [{ label: 'Réseau', value: synergy.subScores.networking ?? 0, sub: `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`, color: '#0a66c2' }] : []),
    ...(careerEnabled && applications.length ? [{ label: 'Carrière', value: synergy.subScores.career ?? 0, sub: `${applications.length} candidature${applications.length !== 1 ? 's' : ''}`, color: 'var(--accent-primary)' }] : []),
    ...(contentEnabled && posts.length ? [{ label: 'Contenu', value: synergy.subScores.content ?? 0, sub: `${posts.length} publication${posts.length !== 1 ? 's' : ''}`, color: '#ff6b6b' }] : []),
    ...(focusEnabled && focusSessions.length ? [{ label: 'Deep Work', value: synergy.subScores.focus ?? 0, sub: `${Math.round(focusSessions.reduce((a, s) => a + s.durationMinutes, 0) / 60)} h enregistrées`, color: '#ffa94d' }] : []),
    // Fundraising/Freelance/Creative/Real Estate (2026-08-27) — same pattern.
    ...(fundraisingEnabled && investors.length ? [{ label: 'Levée de fonds', value: synergy.subScores.fundraising ?? 0, sub: `${investors.length} investisseur${investors.length !== 1 ? 's' : ''}`, color: '#845ef7' }] : []),
    ...(freelanceEnabled && engagements.length ? [{ label: 'Freelance', value: synergy.subScores.freelance ?? 0, sub: `${engagements.length} client${engagements.length !== 1 ? 's' : ''}`, color: '#20c997' }] : []),
    ...(creativeEnabled && creativeWorks.length ? [{ label: 'Création', value: synergy.subScores.creative ?? 0, sub: `${creativeWorks.length} œuvre${creativeWorks.length !== 1 ? 's' : ''}`, color: '#e05e5e' }] : []),
    ...(realEstateEnabled && properties.length ? [{ label: 'Immobilier', value: synergy.subScores.realEstate ?? 0, sub: `${properties.length} bien${properties.length !== 1 ? 's' : ''}`, color: '#94a3b8' }] : []),
  ];

  const activeHabits = habits.filter((h) => !h.archived);
  const doneToday = activeHabits.filter((h) => logs.some((l) => l.habitId === h.id && l.date === today && l.completed));

  const burnout = useMemo(
    () => checkBurnoutTriggers({ energyLogs, compliance: habitCompliance(activeHabits, logs, 7, today), trades: acctTrades }),
    [energyLogs, activeHabits, logs, acctTrades, today]
  );

  // Cross-domain observations & alerts — every piece of data on the site matters,
  // this is where signals from Finance, Trading, Habits, Learning, Skills and
  // Reading all surface together, sorted by severity.
  const observations = useMemo(() => {
    const lastTrade = acctTrades.length ? [...acctTrades].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
    return buildObservations({
      accounting: hasJournal
        ? {
            analysis: accountingStore.getAnalysis(),
            esg: accountingStore.getESG(accountingStore.currentMonthPeriod()),
            budgetVariance: accountingStore.getBudgetVariance(),
            goalRows: accountingStore.getGoalRows(),
          }
        : undefined,
      trading: acctTrades.length
        ? {
            maxDrawdownPct: tradingStore.getMaxDrawdown(activeAccountId),
            tradesCount: acctTrades.length,
            daysSinceLastTrade: lastTrade ? Math.floor((Date.now() - new Date(lastTrade.date).getTime()) / 86400000) : null,
            winRate: monthTrades.length >= 5 ? monthStats.winRate : null,
            baselineWinRate: acctTrades.length >= 10 ? tradingStore.getStats(activeAccountId).winRate : null,
          }
        : undefined,
      habits: activeHabits.length ? { complianceRate: habitCompliance(activeHabits, logs, 7, today).rate * 100 } : undefined,
      learning: courses.length
        ? {
            gpa,
            stalledCourses: courses.filter((c) => c.status === 'active' && calculateCourseProgress(c) === 0 && Date.now() - c.createdAt > 14 * 24 * 60 * 60 * 1000).length,
          }
        : undefined,
      skills: {
        decayedCount: Object.values(skills).filter((s) => s.decayStatus === 'decayed').length,
        warningCount: Object.values(skills).filter((s) => s.decayStatus === 'warning').length,
      },
      readings: { streak: readingStreak, inProgressCount: readingRows.filter((r) => r.status !== 'completed').length },
    });
  }, [hasJournal, accountingStore, acctTrades, tradingStore, activeAccountId, monthTrades, monthStats, activeHabits, logs, today, courses, gpa, skills, readingStreak, readingRows]);

  const OBS_ICON = { danger: AlertTriangle, warning: AlertCircle, success: CheckCircle2, info: Info };
  const OBS_COLOR = { danger: 'var(--error)', warning: 'var(--warning)', success: 'var(--success)', info: 'var(--text-secondary)' };

  const focusItems = useMemo(() => {
    const items = [];
    if (activeHabits.length - doneToday.length > 0)
      items.push({ to: '/habits', text: `Terminer ${activeHabits.length - doneToday.length} habitude(s) restante(s)` });
    if (!todayEnergy) items.push({ to: '/habits', text: 'Faire le check-in du matin (énergie & sommeil)' });
    const unjournaled = monthTrades.filter((t) => !t.journal?.reasoning);
    if (unjournaled.length) items.push({ to: '/trading', text: `Justifier ${unjournaled.length} trade(s) sans raisonnement dans le journal` });
    const lowest = Object.entries(synergy.scores).sort((a, b) => a[1] - b[1])[0];
    if (lowest) items.push({ to: domainRoute(lowest[0]), text: `Renforcer votre pilier le plus faible : ${domainLabel(lowest[0])} (${lowest[1]}/100)` });
    if (!items.length) items.push({ to: '/', text: 'Tout est fait — protégez votre série.' });
    return items;
  }, [activeHabits, doneToday, todayEnergy, monthTrades, synergy.scores]);

  const radarData = Object.entries(synergy.scores).map(([domain, score]) => ({
    domain: domainLabel(domain),
    score,
  }));

  // Skills gaining the most XP this month
  const fastestSkills = useMemo(() => {
    const ms = startOfMonth(new Date()).getTime();
    return Object.values(skills)
      .map((s) => ({ id: s.id, level: s.level, xpMonth: (s.xpLog || []).filter((e) => e.date >= ms && e.amount > 0).reduce((a, e) => a + e.amount, 0) }))
      .filter((s) => s.xpMonth > 0)
      .sort((a, b) => b.xpMonth - a.xpMonth)
      .slice(0, 5);
  }, [skills]);

  // Level-ups in the last 30 days
  const milestones = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return Object.values(skills)
      .flatMap((s) => (s.levelUpDates || []).filter((d) => d >= cutoff).map((d) => ({ id: s.id, date: d, level: s.level })))
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);
  }, [skills]);

  const topStreaks = useMemo(
    () =>
      activeHabits
        .map((h) => ({ ...h, streak: habitStreak(h.id, logs, today, h) }))
        .filter((h) => h.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5),
    [activeHabits, logs, today]
  );

  // Nearest deadlines across Santé / Finances / Apprentissage (see hooks/useAllGoals).
  const upcomingGoals = useMemo(
    () => allGoals.filter((g) => g.targetDate && g.status !== 'achieved' && !g.recurring).sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1)).slice(0, 4),
    [allGoals]
  );

  const TrendIcon = synergy.trend > 0.5 ? TrendingUp : synergy.trend < -0.5 ? TrendingDown : Minus;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bon retour, {user?.name}</h1>
          <p className="text-mute text-sm mt-1">
            Parcours : <span className="text-accent font-medium">{CAREER_FR[user?.careerGoal] || user?.careerGoal || 'Hybride'}</span> · voici où vous en êtes aujourd’hui.
          </p>
        </div>
        {tradingEnabled && <AccountSwitcher />}
      </div>

      {burnout.burnoutRisk && (
        <div className="border border-bad/50 bg-bad/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-bad font-semibold">
            <AlertTriangle size={18} /> Risque d’épuisement détecté ({burnout.overallSeverity === 'high' ? 'élevé' : 'modéré'})
          </div>
          {burnout.triggers.map((t) => (
            <div key={t.trigger} className="text-sm">
              <span className="text-ink">{t.message}</span>
              <span className="text-mute"> — {t.recommendation}</span>
            </div>
          ))}
        </div>
      )}

      {observations.length > 0 && (
        <Card title="Observations & alertes">
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {observations.map((o) => {
              const Icon = OBS_ICON[o.level];
              return (
                <div key={o.id} className="flex items-start gap-2.5 text-sm">
                  <Icon size={15} className="shrink-0 mt-0.5" style={{ color: OBS_COLOR[o.level] }} />
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide mr-1.5" style={{ color: OBS_COLOR[o.level] }}>{OBS_DOMAIN_FR[o.domain] || o.domain}</span>
                    <span className="text-ink">{o.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Grade strip — surfaces the 500-level rank ladder (see Leaderboard) */}
      <Link to="/leaderboard" className="block">
        <div className="rounded-xl border border-line bg-card px-5 py-4 flex items-center gap-4 hover:border-accent transition-colors">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
            <Award size={22} className="text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-mute uppercase tracking-wide">Grade {grade.current.level} · {grade.current.era}</div>
            <div className="text-lg font-bold truncate">{grade.current.name}</div>
          </div>
          <div className="hidden sm:block w-40">
            <div className="flex justify-between text-[10px] text-mute mb-1"><span>Niv. {grade.current.level}</span><span>{Math.round(grade.progress)}%</span></div>
            <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${grade.progress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }} />
            </div>
          </div>
          <ArrowRight size={16} className="text-mute shrink-0" />
        </div>
      </Link>

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${tradingEnabled ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
        {tradingEnabled && <Stat label="Valeur du compte" value={fmtMoney(account)} />}
        {tradingEnabled && <Stat label="P&L du mois" value={fmtSignedMoney(monthStats.totalPnl)} color={monthStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} sub={`${monthStats.count} trades · ${monthStats.count ? fmtPct(monthStats.winRate) : '—'} gagnants`} />}
        <Stat label="Patrimoine net" value={netWorth !== null ? fmtMAD(netWorth) : '—'} sub="calculé depuis vos comptes" />
        <Stat label="GPA" value={gpa !== null ? gpa.toFixed(2) : '—'} sub={`${courses.filter((c) => c.status === 'active').length} cours en cours`} />
        <Stat label="Énergie du jour" value={todayEnergy ? `${todayEnergy.energyStartLevel}/10` : '—'} sub={todayEnergy ? `Stress ${todayEnergy.stressLevel}/10` : 'Pas encore renseignée'} />
      </div>

      {tradingEnabled && hasNonDemo && activeAccountObj?.type !== 'demo' && demoAccounts.length > 0 && (
        <div className="border border-line rounded-xl bg-card">
          <button onClick={() => setDemoOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer text-left">
            {demoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-mute">Compte{demoAccounts.length > 1 ? `s démo (${demoAccounts.length})` : ' démo'} (apprentissage)</span>
            <span className="ml-auto text-mute">{fmtMoney(demoAccount)} · {demoStats.count} trades{demoStats.count ? ` · ${Math.round(demoStats.winRate)}% gagnants` : ''}</span>
          </button>
          {demoOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 pb-4">
              <Stat label="Valeur démo" value={fmtMoney(demoAccount)} />
              <Stat label="P&L démo" value={fmtSignedMoney(demoStats.totalPnl)} color={demoStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
              <Stat label="Taux de réussite démo" value={demoStats.count ? fmtPct(demoStats.winRate) : '—'} sub={`${demoStats.wins} G / ${demoStats.losses} P`} />
              <Stat label="Trades démo" value={demoStats.count} sub="apprentissage + validation" />
            </div>
          )}
        </div>
      )}

      {/* Visualizations replace the old wall of KPI cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {tradingEnabled && (
          <Card title={`Courbe du compte · ${activeAccountObj?.name || ''}`}>
            {equityCurve.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="i" hide />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} width={54} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMoney(v)} labelFormatter={() => ''} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#eqFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>Enregistrez des trades pour voir la courbe de votre compte.</EmptyState>
            )}
          </Card>
        )}

        <Card title="Équilibre de vie" className={!tradingEnabled ? 'lg:col-span-2' : undefined}>
          <div className="space-y-4 pt-1">
            {lifeBalance.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-mute">{b.sub}</span>
                </div>
                <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${b.value}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Score de synergie">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-5xl font-bold" style={{ color: synergyColor(synergy.weighted) }}>
                {String(synergy.weighted).replace('.', ',')}
              </div>
              <div className="text-xs text-mute mt-1">pondéré / 100</div>
              <div className="flex items-center gap-1 text-sm mt-3" style={{ color: synergy.trend >= 0 ? 'var(--success)' : 'var(--error)' }}>
                <TrendIcon size={16} />
                {synergy.trend >= 0 ? '+' : ''}
                {synergy.trend.toFixed(1).replace('.', ',')} vs hier
              </div>
              <div className="text-xs text-mute mt-2">
                Moyenne : <span className="text-ink">{String(synergy.average).replace('.', ',')}</span> · Principal : <span className="text-accent">{domainLabel(synergy.primaryDomain)}</span>
              </div>
            </div>
            <div className="flex-1 h-52">
              <ResponsiveContainer>
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#00d9ff" fill="#00d9ff" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-4">
            {Object.entries(synergy.scores).map(([domain, score]) => (
              <div key={domain} className="text-center">
                <div className="text-lg font-semibold" style={{ color: synergyColor(score) }}>
                  {Math.round(score)}
                </div>
                <div className="text-[10px] text-mute">{domainLabel(domain)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Priorités du jour">
          {focusItems.length ? (
            <ul className="space-y-3">
              {focusItems.map((item, i) => (
                <li key={i}>
                  <Link to={item.to} className="flex items-center justify-between bg-surface border border-line rounded-lg px-4 py-3 text-sm hover:border-accent transition-colors">
                    <span>{item.text}</span>
                    <ArrowRight size={15} className="text-mute" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Rien en attente.</EmptyState>
          )}
          <div className="mt-4 text-xs text-mute">
            Habitudes du jour : <span className="text-ink">{doneToday.length}/{activeHabits.length}</span>
          </div>
        </Card>
      </div>

      {synergy.history.length > 1 && (
        <Card title="Évolution de la synergie (30 jours)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={synergy.history}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="weighted" stroke="#00d9ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="average" stroke="#b366ff" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card title="Compétences en plus forte progression">
          {fastestSkills.length ? (
            <ul className="space-y-2.5">
              {fastestSkills.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Rocket size={14} className="text-accent shrink-0" />
                  <span className="flex-1 truncate">{SKILL_MAP[s.id]?.name}</span>
                  <Badge color="var(--accent-primary)">+{s.xpMonth} XP</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Pas encore d’XP gagnée ce mois-ci.</EmptyState>
          )}
        </Card>

        <Card title="Meilleures séries d’habitudes">
          {topStreaks.length ? (
            <ul className="space-y-2.5">
              {topStreaks.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <Flame size={14} className="text-warn shrink-0" />
                  <span className="flex-1 truncate">{h.name}</span>
                  <Badge color="var(--warning)">{h.streak}d{h.targetStreak ? ` / ${h.targetStreak}` : ''}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Aucune série en cours. Cochez une habitude aujourd’hui.</EmptyState>
          )}
        </Card>

        <Card title="Jalons & échéances">
          {milestones.length || upcomingGoals.length ? (
            <ul className="space-y-2.5">
              {milestones.map((m, i) => (
                <li key={`m${i}`} className="flex items-center gap-2 text-sm">
                  <Award size={14} className="text-accent2 shrink-0" />
                  <span className="flex-1 truncate">
                    {SKILL_MAP[m.id]?.name} : niveau {m.level} atteint ({LEVEL_NAMES_FR[m.level] || LEVEL_NAMES[m.level]})
                  </span>
                  <span className="text-[11px] text-mute">{fmtDate(m.date)}</span>
                </li>
              ))}
              {upcomingGoals.map((g) => (
                <li key={g.key} className="flex items-center gap-2 text-sm">
                  <ArrowRight size={14} className="text-mute shrink-0" />
                  <Link to={g.link} className="flex-1 truncate hover:text-accent">{g.title}</Link>
                  <span className="text-[11px] text-mute">{fmtDate(g.targetDate)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Vos passages de niveau et échéances d’objectifs apparaîtront ici.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

// Pretty labels for the 6-pillar synergy score (2026-08-28 compaction — see
// synergy.js#PILLAR_MEMBERS for the métier-vs-cross-cutting-layer
// architecture). The 3 composites are camelCase keys that `capitalize` CSS
// can't split into words, so they get an explicit label; Learning/Finance/
// Health just get their name capitalized.
const PILLAR_LABEL = { metiersVentures: 'Métiers & projets', careerDevelopment: 'Carrière', growthOutput: 'Progression', learning: 'Apprentissage', finance: 'Finances', health: 'Santé' };
const LEVEL_NAMES_FR = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Avancé', 4: 'Expert', 5: 'Maître' };
const CAREER_FR = { Hybrid: 'Hybride', Trading: 'Trading', PE: 'Private equity', GE: 'Growth equity', VC: 'Capital-risque', RBF: 'Financement sur revenus' };
const OBS_DOMAIN_FR = { Skills: 'Compétences', Finance: 'Finances', Trading: 'Trading', Habitudes: 'Habitudes', Apprentissage: 'Apprentissage', Lecture: 'Lecture', Objectifs: 'Objectifs', Budget: 'Budget' };
function domainLabel(domain) {
  return PILLAR_LABEL[domain] || (domain ? domain[0].toUpperCase() + domain.slice(1) : domain);
}

// A composite pillar has no single page — this picks one representative
// destination (its first/primary member) rather than nothing.
function domainRoute(domain) {
  return {
    learning: '/learning', finance: '/finance', health: '/habits',
    metiersVentures: '/trading', careerDevelopment: '/career', growthOutput: '/skills',
  }[domain] || '/';
}
