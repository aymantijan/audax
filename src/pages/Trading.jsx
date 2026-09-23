import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Wallet, BatteryLow, Bell, BellOff, Flame, ShieldAlert, Settings2, FileDown, Sun, BookOpen, BarChart3, Briefcase, Scale, ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Cell,
} from 'recharts';
import { useTradingStore } from '../store/tradingStore';
import { useHabitStore } from '../store/habitStore';
import { isHabitShownOn, computeTradeDerived } from '../utils/calculations';
import { INSTRUMENTS, STRATEGIES } from '../utils/constants';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, EmptyState } from '../components/common/ui';
import BadgeList from '../components/common/BadgeList';
import AccountSwitcher from '../components/common/AccountSwitcher';
import TradeForm from '../components/trading/TradeForm';
import PreTradingChecklist from '../components/trading/PreTradingChecklist';
import BurnRateTracker from '../components/trading/BurnRateTracker';
import AdvancedAnalytics from '../components/trading/AdvancedAnalytics';
import RiskManagement from '../components/trading/RiskManagement';
import TradingPsychology from '../components/trading/TradingPsychology';
import JournalAnalysis from '../components/trading/JournalAnalysis';
import PredictionsPanel from '../components/trading/PredictionsPanel';
import TradingCoach from '../components/trading/TradingCoach';
import ScorePanel from '../components/trading/ScorePanel';
import CustomizeTradingModal from '../components/trading/CustomizeTradingModal';
import PnLCalendar from '../components/trading/PnLCalendar';
import TradeCsvTools from '../components/trading/TradeCsvTools';
import TradingAccounts from './TradingAccounts';
import { tradeRMultiple, rMultipleStats } from '../utils/risk-management';
import { currentLossStreak } from '../utils/trading-psychology';
import { planSplit } from '../utils/trading-plan';
import { mistakeStats, mistakesOf } from '../utils/trading-journal';
import PlaybookCard from '../components/trading/PlaybookCard';
import { toast } from '../store/uiStore';
import { exportTradingReportPDF } from '../utils/trading-report-pdf';

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--text-secondary)' },
};
const tint = (c, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);

const SPACES = [
  { key: 'today', label: 'Today', desc: 'Checklist, rules & today’s P&L', icon: Sun },
  { key: 'journal', label: 'Journal', desc: 'Trade log, calendar & lessons', icon: BookOpen },
  { key: 'analytics', label: 'Analytics', desc: 'Edge, risk & psychology', icon: BarChart3 },
  { key: 'accounts', label: 'Accounts', desc: 'Demo, broker & prop firms', icon: Briefcase },
];

// Habits flagged "obligatoire avant de trader" that are still undone today.
function MandatoryHabitsAlert() {
  const habits = useHabitStore((st) => st.habits);
  const logs = useHabitStore((st) => st.logs);
  const today = todayKey();
  const missing = habits.filter((h) => !h.archived && h.mandatory && isHabitShownOn(h, logs, today)
    && !logs.some((l) => l.habitId === h.id && l.date === today && l.completed));
  if (!missing.length) return null;
  return (
    <div className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm flex items-start gap-2">
      <ShieldAlert size={16} className="text-warn shrink-0 mt-0.5" />
      <span className="flex-1">
        <b>Before trading:</b> {missing.map((h) => h.name).join(', ')} {missing.length > 1 ? 'are' : 'is'} not done yet (mandatory habit{missing.length > 1 ? 's' : ''}).{' '}
        <Link to="/habits" className="underline">Open habits</Link>
      </span>
    </div>
  );
}

function PlanBadge({ t }) {
  if (t.followedPlan === true) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: 'var(--success)', background: tint('var(--success)', 12) }}>ON</span>;
  if (t.followedPlan === false) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" title={(t.planBreaks || []).join(', ')} style={{ color: 'var(--error)', background: tint('var(--error)', 12) }}>OFF</span>;
  return <span className="text-mute">—</span>;
}

// On-plan vs off-plan: what trading against your own rules really costs.
function PlanDisciplineCard({ trades, currency }) {
  const s = useMemo(() => planSplit(trades), [trades]);
  const m = useMemo(() => mistakeStats(trades), [trades]);
  const Col = ({ label, g, color }) => (
    <div className="rounded-xl border p-3" style={{ borderColor: tint(color, 35), background: tint(color, 5) }}>
      <div className="text-xs font-semibold mb-2" style={{ color }}>{label} · {g.count} trade{g.count === 1 ? '' : 's'}</div>
      {g.count ? (
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-mute text-xs">Net P&L</span><span className="text-right font-semibold tabular-nums" style={{ color: g.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(g.pnl, currency)}</span>
          <span className="text-mute text-xs">Win rate</span><span className="text-right tabular-nums">{fmtPct(g.winRate)}</span>
          <span className="text-mute text-xs">Expectancy</span><span className="text-right tabular-nums">{g.rCount ? fmtR(g.expR) : `${fmtSignedMoney(g.avgPnl, currency)}/trade`}</span>
        </div>
      ) : <div className="text-xs text-mute">No trades yet.</div>}
    </div>
  );
  return (
    <Card title="Plan discipline & mistakes" action={s.onPlanPct != null ? <span className="text-xs text-mute">{Math.round(s.onPlanPct)}% of tagged trades on plan</span> : null}>
      {s.tagged === 0 && m.tags.length === 0 ? (
        <EmptyState>Every new trade is tagged <b>on plan</b> or <b>off plan</b>. Once you have a few of each, this compares what following your rules earns you against breaking them.</EmptyState>
      ) : (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Col label="On plan" g={s.on} color="var(--success)" />
            <Col label="Off plan" g={s.off} color="var(--error)" />
          </div>
          {s.off.count > 0 && s.off.pnl < 0 && (
            <p className="text-sm"><Scale size={14} className="inline -mt-0.5 mr-1 text-bad" />Off-plan trades cost you <b className="text-bad">{fmtMoney(Math.abs(s.off.pnl), 0, currency)}</b> on this account.</p>
          )}
          {m.tags.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-mute mb-1.5">What your mistakes cost (all trades)</div>
              {m.clean.count > 0 && (
                <p className="text-xs text-mute mb-1.5">Clean trades: <b className="text-ink">{m.clean.count}</b> · {m.clean.expR != null ? fmtR(m.clean.expR) : fmtSignedMoney(m.clean.avgPnl, currency)} per trade — with a mistake: <b className="text-ink">{m.withMistakes.count}</b> · {m.withMistakes.expR != null ? fmtR(m.withMistakes.expR) : fmtSignedMoney(m.withMistakes.avgPnl, currency)} per trade.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {m.tags.slice(0, 8).map((b) => (
                  <span key={b.label} className="text-xs px-2 py-0.5 rounded-full border border-line">
                    {b.label} · {b.count}× · <span style={{ color: b.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(b.pnl, currency)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {s.untagged > 0 && <p className="text-[11px] text-mute">{s.untagged} older trade{s.untagged > 1 ? 's are' : ' is'} not tagged — edit {s.untagged > 1 ? 'them' : 'it'} in the Journal to include {s.untagged > 1 ? 'them' : 'it'}.</p>}
        </div>
      )}
    </Card>
  );
}

// Open positions: not in any stat until closed; partials bank P&L along the way.
function OpenPositionsCard({ positions, currency, onClosePos, onEditPos }) {
  const { addPartial, removePartial, discardPosition, getInstrumentSpecs } = useTradingStore();
  const [partialFor, setPartialFor] = useState(null);
  const [pf, setPf] = useState({ exitPrice: '', size: '', pnl: '' });
  const [pnlTouched, setPnlTouched] = useState(false);
  const autoPnl = partialFor ? computeTradeDerived({ ...partialFor, exitPrice: pf.exitPrice, positionSize: pf.size }, getInstrumentSpecs()).pnl : 0;
  const pnlValue = pnlTouched ? pf.pnl : (autoPnl || '');
  const remaining = (p) => Math.max(0, Number(p.positionSize) - (p.partials || []).reduce((a, x) => a + Number(x.size || 0), 0));
  if (!positions.length) return null;
  return (
    <Card title={`Open positions (${positions.length})`}>
      <ul className="divide-y divide-line/60">
        {positions.map((p) => {
          const banked = (p.partials || []).reduce((a, x) => a + Number(x.pnl || 0), 0);
          return (
            <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
              <span className="font-medium">{p.instrument}</span>
              <span className="capitalize text-mute">{p.direction}</span>
              <span className="text-mute tabular-nums">{remaining(p)}{(p.partials || []).length ? `/${p.positionSize}` : ''} @ {p.entryPrice}</span>
              {Number(p.stopLoss) > 0 && <span className="text-xs text-mute">SL {p.stopLoss}</span>}
              {Number(p.riskAmount) > 0 && <span className="text-xs text-mute">risk {fmtMoney(p.riskAmount, 0, currency)}</span>}
              <span className="text-xs text-mute">{p.strategy}{p.session ? ` · ${p.session}` : ''}{p.timeframe ? ` · ${p.timeframe}` : ''}</span>
              {(p.partials || []).length > 0 && <span className="text-xs" style={{ color: banked >= 0 ? 'var(--success)' : 'var(--error)' }}>banked {fmtSignedMoney(banked, currency)}</span>}
              <span className="ml-auto flex items-center gap-1.5">
                <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => { setPartialFor(p); setPf({ exitPrice: '', size: '', pnl: '' }); setPnlTouched(false); }}>Partial</Button>
                <Button className="!py-1 !px-2 text-xs" onClick={() => onClosePos(p)}>Close</Button>
                <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={() => onEditPos(p)} title="Edit (move stop, notes…)"><Pencil size={13} /></button>
                <button className="p-1 text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Remove this open position without logging a trade?')) discardPosition(p.id); }} title="Remove"><Trash2 size={13} /></button>
              </span>
              {(p.partials || []).length > 0 && (
                <div className="w-full pl-5 flex flex-wrap gap-1.5">
                  {p.partials.map((x) => (
                    <span key={x.id} className="text-[11px] px-2 py-0.5 rounded-full border border-line text-mute">
                      {x.size} @ {x.exitPrice} · <span style={{ color: x.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(x.pnl, currency)}</span>
                      <button className="ml-1 hover:text-bad cursor-pointer" onClick={() => removePartial(p.id, x.id)} title="Undo partial">×</button>
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Modal open={!!partialFor} onClose={() => setPartialFor(null)} title={`Partial close · ${partialFor?.instrument || ''}`}>
        {partialFor && (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const size = Number(pf.size);
            if (!(size > 0) || size >= remaining(partialFor)) return toast(`Size must be between 0 and ${remaining(partialFor)} (use Close for the rest)`, 'error');
            if (!(Number(pf.exitPrice) > 0)) return toast('Exit price is required', 'error');
            addPartial(partialFor.id, { exitPrice: pf.exitPrice, size, pnl: Number(pnlValue) || 0 });
            setPartialFor(null);
          }}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Exit price"><Input type="number" step="any" value={pf.exitPrice} onChange={(e) => setPf({ ...pf, exitPrice: e.target.value })} autoFocus /></Field>
              <Field label={`Size closed (of ${remaining(partialFor)})`}><Input type="number" step="any" value={pf.size} onChange={(e) => setPf({ ...pf, size: e.target.value })} /></Field>
              <Field label={`P&L (${currency})`} hint={autoPnl ? `Auto: ${autoPnl}` : ''}><Input type="number" step="any" value={pnlValue} onChange={(e) => { setPnlTouched(true); setPf({ ...pf, pnl: e.target.value }); }} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPartialFor(null)}>Cancel</Button>
              <Button type="submit">Record partial</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

function PnLBarCard({ title, data, currency, empty }) {
  return (
    <Card title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} formatter={(v) => fmtSignedMoney(v, currency)} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.pnl >= 0 ? '#00d97f' : '#ff6b6b'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState>{empty}</EmptyState>}
    </Card>
  );
}

export default function Trading() {
  // Subscribe to the whole store so any trade change (add/edit/delete) re-renders.
  const tradingStore = useTradingStore();
  const { deleteTrade, adjustAccountBalance, alerts, setAlertsEnabled, getBadges } = tradingStore;
  const badges = getBadges();
  const [searchParams, setSearchParams] = useSearchParams();
  // QuickAdd FAB deep-links here as /trading?quickadd=trade — read once on
  // mount (not a live subscription) so it opens the form exactly once.
  const [formOpen, setFormOpen] = useState(() => searchParams.get('quickadd') === 'trade');
  const [space, setSpace] = useState(() => (SPACES.some((s) => s.key === searchParams.get('tab')) ? searchParams.get('tab') : 'today'));
  const [editing, setEditing] = useState(null);
  const [posForm, setPosForm] = useState(null); // { position, mode: 'close' | 'edit' }
  const [filterInstrument, setFilterInstrument] = useState('all');
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm] = useState({ newBalance: '', reason: '' });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const todayEnergyLog = useHabitStore((s) => s.energyLogs.find((l) => l.date === todayKey()));
  const today = todayKey();

  // Links such as the account switcher's "Manage accounts" change ?tab= while the page is open.
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam && tabParam !== space && SPACES.some((s) => s.key === tabParam)) setSpace(tabParam);
  }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get('tab') !== space) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', space); next.delete('quickadd');
      setSearchParams(next, { replace: true });
    }
  }, [space]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAlerts = async () => {
    if (alerts.enabled) return setAlertsEnabled(false);
    if (typeof Notification === 'undefined') return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') setAlertsEnabled(true);
  };

  // Everything on this page is scoped to the active account — via centralized selectors.
  const activeAccountId = tradingStore.activeAccountId;
  const activeAccount = tradingStore.getAccount(activeAccountId);
  const initialBalance = tradingStore.getInitialBalance(activeAccountId);
  const trades = tradingStore.getAccountTrades(activeAccountId);
  const stats = tradingStore.getStats(activeAccountId);
  const monthStats = tradingStore.getMonthStats(activeAccountId);
  const account = tradingStore.accountValue(activeAccountId);
  const curve = tradingStore.getEquityCurve(activeAccountId);
  const maxDd = tradingStore.getMonthMaxDrawdown(activeAccountId);
  const currency = activeAccount?.currency || 'USD';
  const rStats = useMemo(() => rMultipleStats(trades), [trades]);
  const monthKey = today.slice(0, 7);
  const monthPlan = useMemo(() => planSplit(trades.filter((t) => t.date?.startsWith(monthKey))), [trades, monthKey]);

  // Cross-domain risk banners: live loss streak + prop-firm / risk-limit breaches.
  const lossStreak = currentLossStreak(trades);
  const propFirmProgress = activeAccount?.type === 'propfirm' ? tradingStore.getPropFirmProgress(activeAccountId) : null;
  const riskLimitBreaches = activeAccount?.type !== 'propfirm' ? tradingStore.getRiskLimitBreaches(activeAccountId) : [];
  const hardBreach = propFirmProgress?.breaches?.find((b) => b.level === 'danger') || riskLimitBreaches.find((b) => b.level === 'danger');

  // Today on this account + room left before the daily loss limit.
  const todayTrades = trades.filter((t) => t.date === today);
  const positions = (tradingStore.openPositions || []).filter((p) => p.accountId === activeAccountId);
  const playbook = tradingStore.playbook || {};
  const isAplus = (t) => { const c = playbook[t.strategy]?.criteria || []; return c.length > 0 && Array.isArray(t.criteriaMet) && c.every((x) => t.criteriaMet.includes(x)); };
  const todayPnl = todayTrades.reduce((a, t) => a + t.pnl, 0);
  const dailyLimitPct = activeAccount?.type === 'propfirm' ? activeAccount?.propFirmRules?.maxDailyLossPct : activeAccount?.riskLimits?.maxDailyLossPct;
  const dailyRoom = dailyLimitPct != null && initialBalance > 0 ? (initialBalance * dailyLimitPct) / 100 - Math.max(0, -todayPnl) : null;

  const instrumentList = useMemo(() => [...INSTRUMENTS, ...tradingStore.customInstruments.map((c) => c.code)], [tradingStore.customInstruments]);
  const strategyList = useMemo(() => [...STRATEGIES, ...tradingStore.customStrategies.map((c) => c.name)], [tradingStore.customStrategies]);
  const byStrategy = useMemo(
    () => strategyList.map((s) => ({ name: s, pnl: trades.filter((t) => t.strategy === s).reduce((a, t) => a + t.pnl, 0) })).filter((d) => d.pnl !== 0),
    [trades, strategyList]
  );
  const byInstrument = useMemo(
    () => instrumentList.map((i) => ({ name: i, pnl: trades.filter((t) => t.instrument === i).reduce((a, t) => a + t.pnl, 0) })).filter((d) => d.pnl !== 0),
    [trades, instrumentList]
  );
  const filtered = useMemo(
    () => [...trades]
      .filter((t) => filterInstrument === 'all' || t.instrument === filterInstrument)
      .filter((t) => filterStrategy === 'all' || t.strategy === filterStrategy)
      .filter((t) => filterPlan === 'all' || (filterPlan === 'on' ? t.followedPlan === true : filterPlan === 'off' ? t.followedPlan === false : t.followedPlan == null))
      .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || 0) - (a.createdAt || 0)),
    [trades, filterInstrument, filterStrategy, filterPlan]
  );

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };
  const remove = (t) => { if (confirm('Delete this trade? Linked XP will be reversed.')) deleteTrade(t.id); };

  const accountValueCard = (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-mute mb-1">Account value</div>
        <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setBalForm({ newBalance: String(initialBalance), reason: '' }); setBalModal(true); }} title="Edit starting balance">
          <Wallet size={13} />
        </button>
      </div>
      <div className="text-2xl font-bold">{fmtMoney(account, 0, currency)}</div>
      <div className="text-xs text-mute mt-1">Start: {fmtMoney(initialBalance, 0, currency)}</div>
    </div>
  );

  const expectancy = rStats
    ? { value: fmtR(rStats.expectancyR), sub: `${fmtSignedMoney(stats.expectancyUsd, currency)} / trade${rStats.missingRiskCount ? ` · ${rStats.missingRiskCount} without risk` : ''}` }
    : { value: stats.count ? fmtSignedMoney(stats.expectancyUsd, currency) : '—', sub: stats.count ? 'per trade · add risk to see R' : '' };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <MandatoryHabitsAlert />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trading</h1>
          <p className="text-mute text-sm mt-1">Plan, journal and validate your edge — {activeAccount?.name || 'account'} in {currency}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setCustomizeOpen(true)} title="Customize instruments & strategies"><Settings2 size={16} /></button>
          {activeAccount && (
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => exportTradingReportPDF(activeAccount, trades)} title="Export account report (PDF)"><FileDown size={16} /></button>
          )}
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={toggleAlerts}>
            <span className="flex items-center gap-2">{alerts.enabled ? <Bell size={13} /> : <BellOff size={13} />}{alerts.enabled ? 'Alerts on' : 'Enable alerts'}</span>
          </Button>
          <AccountSwitcher />
          <Button onClick={openNew}><span className="flex items-center gap-2"><Plus size={16} /> Log Trade</span></Button>
        </div>
      </div>

      {hardBreach && (
        <div className="flex items-center gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-lg px-4 py-3">
          <ShieldAlert size={16} className="shrink-0" /> {hardBreach.message} Stop trading on this account for today.
        </div>
      )}
      {lossStreak >= 2 && (
        <div className="flex items-center gap-2 text-sm border border-bad/50 bg-bad/10 text-bad rounded-lg px-4 py-3">
          <Flame size={16} className="shrink-0" /> You're on a {lossStreak}-loss streak on this account — classic tilt territory. Step away or cut size before the next trade.
        </div>
      )}
      {todayEnergyLog && todayEnergyLog.energyStartLevel < 5 && (
        <div className="flex items-center gap-2 text-sm border border-warn/50 bg-warn/10 text-warn rounded-lg px-4 py-3">
          <BatteryLow size={16} className="shrink-0" /> Energy is low today ({todayEnergyLog.energyStartLevel}/10) — consider skipping afternoon trading or cutting position size.
        </div>
      )}

      <nav className="grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-surface p-1.5" aria-label="Trading spaces">
        {SPACES.map((sp) => {
          const Icon = sp.icon;
          const active = sp.key === space;
          return (
            <button key={sp.key} onClick={() => setSpace(sp.key)} aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition-colors cursor-pointer sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left ${active ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-mute hover:bg-card/50 hover:text-ink'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-accent/15 text-accent' : 'bg-card/60'}`}><Icon size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold sm:text-sm">{sp.label}</span>
                <span className="hidden truncate text-[11px] text-mute lg:block">{sp.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {space === 'today' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {accountValueCard}
            <Stat label="Today" value={fmtSignedMoney(todayPnl, currency)} color={todayPnl > 0 ? 'var(--success)' : todayPnl < 0 ? 'var(--error)' : undefined} sub={`${todayTrades.length} trade${todayTrades.length === 1 ? '' : 's'}`} />
            {dailyRoom != null
              ? <Stat label="Daily loss room" value={fmtMoney(Math.max(0, dailyRoom), 0, currency)} color={dailyRoom <= 0 ? 'var(--error)' : dailyRoom < (initialBalance * dailyLimitPct) / 100 * 0.3 ? 'var(--warning)' : undefined} sub={`limit ${dailyLimitPct}% of start`} />
              : <Stat label="Month P&L" value={fmtSignedMoney(monthStats.totalPnl, currency)} color={monthStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} sub={`${monthStats.count || 0} trades`} />}
            <Stat label="On plan (month)" value={monthPlan.onPlanPct != null ? `${Math.round(monthPlan.onPlanPct)}%` : '—'} sub={monthPlan.tagged ? `${monthPlan.on.count}/${monthPlan.tagged} tagged trades` : 'tag trades when you log them'}
              color={monthPlan.onPlanPct == null ? undefined : monthPlan.onPlanPct >= 80 ? 'var(--success)' : monthPlan.onPlanPct >= 60 ? 'var(--warning)' : 'var(--error)'} />
          </div>
          <OpenPositionsCard positions={positions} currency={currency} onClosePos={(p) => setPosForm({ position: p, mode: 'close' })} onEditPos={(p) => setPosForm({ position: p, mode: 'edit' })} />
          <div className="grid lg:grid-cols-3 gap-5">
            <PreTradingChecklist />
            <Card title={`Today's trades (${todayTrades.length})`} action={<button className="text-xs text-accent hover:underline cursor-pointer" onClick={openNew}>+ Log trade</button>}>
              {todayTrades.length ? (
                <ul className="divide-y divide-line/60">
                  {todayTrades.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                      <PlanBadge t={t} />
                      <span className="flex-1 min-w-0 truncate">{t.instrument} · <span className="capitalize text-mute">{t.direction}</span> · <span className="text-mute">{t.strategy}</span></span>
                      <span className="text-xs text-mute tabular-nums">{fmtR(tradeRMultiple(t))}</span>
                      <span className="font-semibold tabular-nums" style={{ color: t.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(t.pnl, currency)}</span>
                      <button className="text-mute hover:text-accent cursor-pointer" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState>No trades today. Check the list on the left before the first one.</EmptyState>}
            </Card>
            <BurnRateTracker trades={trades} accountValue={account} currency={currency} />
          </div>
          <TradingCoach accountId={activeAccountId} currency={currency} />
        </div>
      )}

      {space === 'journal' && (
        <div className="space-y-5">
          <PlaybookCard trades={trades} currency={currency} />
          <Card
            title={`Trade Log (${filtered.length})`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} options={[{ value: 'all', label: 'On & off plan' }, { value: 'on', label: 'On plan' }, { value: 'off', label: 'Off plan' }, { value: 'untagged', label: 'Not tagged' }]} />
                <Select value={filterInstrument} onChange={(e) => setFilterInstrument(e.target.value)} options={[{ value: 'all', label: 'All instruments' }, ...instrumentList.map((i) => ({ value: i, label: i }))]} />
                <Select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} options={[{ value: 'all', label: 'All strategies' }, ...strategyList.map((s) => ({ value: s, label: s }))]} />
                <TradeCsvTools trades={filtered} accountName={activeAccount?.name} />
              </div>
            }
          >
            {filtered.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mute border-b border-line">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Plan</th>
                      <th className="py-2 pr-4">Instrument</th>
                      <th className="py-2 pr-4">Setup</th>
                      <th className="py-2 pr-4">Dir</th>
                      <th className="py-2 pr-4">Session · TF</th>
                      <th className="py-2 pr-4 text-right">R</th>
                      <th className="py-2 pr-4 text-right">P&L</th>
                      <th className="py-2 pr-4">Emotion</th>
                      <th className="py-2 pr-4">Journal</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b border-line/50 hover:bg-surface/50">
                        <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateShort(t.date)}</td>
                        <td className="py-2.5 pr-4"><PlanBadge t={t} /></td>
                        <td className="py-2.5 pr-4">{t.instrument}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">{t.strategy}{isAplus(t) && <span className="ml-1 text-[10px] font-bold text-good">A+</span>}{mistakesOf(t).length > 0 && <span className="ml-1 text-[10px] text-bad" title={mistakesOf(t).join(', ')}>⚠{mistakesOf(t).length}</span>}</td>
                        <td className="py-2.5 pr-4 capitalize">{t.direction}</td>
                        <td className="py-2.5 pr-4 text-xs text-mute whitespace-nowrap">{t.session || '—'}{t.timeframe ? ` · ${t.timeframe}` : ''}</td>
                        <td className="py-2.5 pr-4 text-right text-mute tabular-nums">{fmtR(tradeRMultiple(t))}</td>
                        <td className="py-2.5 pr-4 text-right font-medium tabular-nums" style={{ color: t.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>
                          {fmtSignedMoney(t.pnl, currency)}
                          {Number(t.fees) > 0 && <div className="text-[10px] font-normal text-mute">fees {fmtMoney(t.fees, 0, currency)}</div>}
                        </td>
                        <td className="py-2.5 pr-4 capitalize text-mute">{t.journal?.emotion}</td>
                        <td className="py-2.5 pr-4">{t.journal?.reasoning ? '✓' : <span className="text-warn">—</span>}</td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {t.chartUrl && <a href={t.chartUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-mute hover:text-accent mr-3" title="Open chart"><ExternalLink size={14} /></a>}
                          <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => openEdit(t)}><Pencil size={14} /></button>
                          <button className="text-mute hover:text-bad cursor-pointer" onClick={() => remove(t)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState>No trades match. Use “Log Trade” to add your first one.</EmptyState>}
          </Card>
          <PnLCalendar trades={trades} currency={currency} />
          <JournalAnalysis trades={trades} currency={currency} />
        </div>
      )}

      {space === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {accountValueCard}
            <Stat label="Total P&L" value={fmtSignedMoney(stats.totalPnl, currency)} color={stats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
            <Stat label="Month P&L" value={fmtSignedMoney(monthStats.totalPnl, currency)} color={monthStats.totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
            <Stat label="Win rate" value={stats.count ? fmtPct(stats.winRate) : '—'} sub={`${stats.wins}W / ${stats.losses}L`} />
            <Stat label="Expectancy" value={expectancy.value} sub={expectancy.sub} color={rStats ? (rStats.expectancyR >= 0 ? 'var(--success)' : 'var(--error)') : undefined} />
            <Stat label="Max DD (month)" value={fmtPct(maxDd, 1)} color={maxDd > 10 ? 'var(--error)' : undefined} />
          </div>
          <PlanDisciplineCard trades={trades} currency={currency} />
          <Card title="Equity Curve">
            {trades.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={curve.map((p, i) => ({ ...p, idx: i, label: p.date ? fmtDateShort(p.date) : 'Start' }))}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v) => fmtMoney(v, 0, currency)} />
                  <Line type="monotone" dataKey="value" stroke="#00d9ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState>Log your first trade to see the curve.</EmptyState>}
          </Card>
          <div className="grid lg:grid-cols-2 gap-5">
            <PnLBarCard title="Strategy P&L" data={byStrategy} currency={currency} empty="No strategy data yet." />
            <PnLBarCard title="Instrument P&L" data={byInstrument} currency={currency} empty="No instrument data yet." />
          </div>
          <AdvancedAnalytics trades={trades} currency={currency} instruments={instrumentList} strategies={strategyList} />
          <RiskManagement trades={trades} accountValue={account} currency={currency} instruments={instrumentList} />
          <TradingPsychology trades={trades} currency={currency} />
          <PredictionsPanel account={activeAccount} trades={trades} currency={currency} />
          <BadgeList badges={badges} />
        </div>
      )}

      {space === 'accounts' && (
        <div className="space-y-5">
          <ScorePanel />
          <TradingAccounts embedded />
        </div>
      )}

      <TradeForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <TradeForm open={!!posForm} onClose={() => setPosForm(null)} editing={null} position={posForm?.position || null} positionMode={posForm?.mode || null} />
      <CustomizeTradingModal open={customizeOpen} onClose={() => setCustomizeOpen(false)} />

      <Modal open={balModal} onClose={() => setBalModal(false)} title={`Edit ${activeAccount?.name || 'account'} balance`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(balForm.newBalance)) return;
            adjustAccountBalance(activeAccountId, balForm.newBalance, balForm.reason);
            setBalModal(false);
          }}
        >
          <div className="text-sm text-mute">
            Current start: <span className="text-ink font-medium">{fmtMoney(initialBalance, 0, currency)}</span> · trades P&amp;L: <span className="text-ink">{fmtSignedMoney(account - initialBalance, currency)}</span>
          </div>
          <div className="text-xs text-mute">Changing the starting balance recalculates account value, ROI, and max drawdown. Trades are not modified.</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`New starting balance (${currency})`}>
              <Input type="number" step="any" value={balForm.newBalance} onChange={(e) => setBalForm({ ...balForm, newBalance: e.target.value })} autoFocus />
            </Field>
            <Field label="Reason">
              <Input value={balForm.reason} onChange={(e) => setBalForm({ ...balForm, reason: e.target.value })} placeholder="Deposit, withdrawal, fees…" />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setBalModal(false)}>Cancel</Button>
            <Button type="submit">Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
