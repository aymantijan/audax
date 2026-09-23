import { useMemo, useState } from 'react';
import { ClipboardList, Moon, CalendarRange, ChevronLeft, ChevronRight, OctagonX, Pencil, Target } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDate, todayKey } from '../../utils/formatters';
import { Card, Button, Field, Input, Textarea, Modal, ProgressBar } from '../common/ui';
import { routineKey, weekStartOf, addDays, planStatus, periodSummary, GRADES, gradeColor, BIASES } from '../../utils/trading-routine';
import { toast } from '../../store/uiStore';

const fmtR = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${(Math.round(r * 100) / 100).toFixed(2)}R`);
const tint = (c, p = 12) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const LESSON_DECK = 'Trading — lessons';
const EMPTY_WEEK = { grade: '', worked: '', fix: '', focusNext: '' };

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`px-2 py-0.5 rounded-full border text-[11px] cursor-pointer ${on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:text-ink'}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function GradePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRADES.map((g) => (
        <button key={g.value} type="button" onClick={() => onChange(g.value)} title={g.hint}
          className="w-10 h-10 rounded-xl border text-base font-bold cursor-pointer"
          style={value === g.value ? { borderColor: g.color, color: g.color, background: tint(g.color, 14) } : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          {g.value}
        </button>
      ))}
      {value && <span className="self-center text-xs text-mute ml-1">{GRADES.find((g) => g.value === value)?.hint}</span>}
    </div>
  );
}

const GradeBadge = ({ g, size = 'md' }) => (
  <span className={`inline-flex items-center justify-center rounded-lg font-bold ${size === 'sm' ? 'w-6 h-6 text-xs' : 'w-9 h-9 text-base'}`} style={{ color: gradeColor(g), background: tint(gradeColor(g), 14) }}>{g}</span>
);

// ── Session plan (before the first trade) ──
function PlanModal({ open, onClose, accountId, day, instruments, strategies, currency, suggestedMaxLoss }) {
  const { dailyPlans, savePlan } = useTradingStore();
  const [f, setF] = useState(null);
  const [lastKey, setLastKey] = useState('');
  const k = `${open}|${accountId}|${day}`;
  if (open && k !== lastKey) {
    setLastKey(k);
    const existing = (dailyPlans || {})[routineKey(accountId, day)];
    // Otherwise start from the most recent plan of this account (limits rarely change).
    const prev = existing || Object.entries(dailyPlans || {}).filter(([key]) => key.startsWith(`${accountId}|`) && key < routineKey(accountId, day)).sort(([a], [b]) => (a < b ? 1 : -1))[0]?.[1];
    setF({
      bias: existing?.bias || 'neutral', instruments: prev?.instruments || [], setups: prev?.setups || [],
      maxTrades: prev?.maxTrades ?? 3, maxLoss: prev?.maxLoss ?? (suggestedMaxLoss ? Math.round(suggestedMaxLoss) : ''),
      levels: existing?.levels || '', news: existing?.news || '', notes: existing?.notes || '',
    });
  }
  if (!open && lastKey) setLastKey('');
  if (!open || !f) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Session plan · ${fmtDate(day)}`} wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); savePlan(accountId, day, { ...f, maxTrades: Number(f.maxTrades) || null, maxLoss: Number(f.maxLoss) || null }); onClose(); }}>
        <div>
          <div className="text-xs text-mute mb-1.5">Bias</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BIASES.map((b) => (
              <button key={b.value} type="button" onClick={() => setF((p) => ({ ...p, bias: b.value }))}
                className={`rounded-lg border py-2 text-xs font-semibold cursor-pointer ${f.bias === b.value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}>{b.label}</button>
            ))}
          </div>
        </div>
        <Field label="Instruments I will trade"><Chips options={instruments} value={f.instruments} onChange={(v) => setF((p) => ({ ...p, instruments: v }))} /></Field>
        <Field label="Setups allowed today"><Chips options={strategies} value={f.setups} onChange={(v) => setF((p) => ({ ...p, setups: v }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max trades today" hint="Reaching it = stop for the day"><Input type="number" min="1" value={f.maxTrades} onChange={(e) => setF((p) => ({ ...p, maxTrades: e.target.value }))} /></Field>
          <Field label={`Max loss today (${currency})`} hint={suggestedMaxLoss ? `Account rule leaves ${fmtMoney(suggestedMaxLoss, 0, currency)} — plan below it` : 'Stop when today’s loss reaches this'}><Input type="number" min="0" step="any" value={f.maxLoss} onChange={(e) => setF((p) => ({ ...p, maxLoss: e.target.value }))} /></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Key levels / scenarios"><Textarea value={f.levels} onChange={(e) => setF((p) => ({ ...p, levels: e.target.value }))} placeholder={'EURUSD: 1.0850 support, 1.0920 PDH\nIf London sweeps Asia low → look for longs'} /></Field>
          <Field label="News & events"><Textarea value={f.news} onChange={(e) => setF((p) => ({ ...p, news: e.target.value }))} placeholder="14:30 CPI — flat 15 min before and after" /></Field>
        </div>
        <Field label="Notes (mindset, focus)"><Input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} placeholder="Only A+ setups. Walk away after 2 losses." /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save plan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function SessionPlanCard({ accountId, todayTrades, currency, instruments, strategies, suggestedMaxLoss }) {
  const { dailyPlans, weekReviews } = useTradingStore();
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const plan = (dailyPlans || {})[routineKey(accountId, today)];
  const ps = planStatus(plan, todayTrades);
  const focus = (weekReviews || {})[routineKey(accountId, addDays(weekStartOf(today), -7))]?.focusNext;
  const bias = BIASES.find((b) => b.value === plan?.bias)?.label;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ClipboardList size={16} className="text-accent" />
        <span className="text-sm font-semibold flex-1">Session plan</span>
        {plan && <button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setOpen(true)}><Pencil size={12} /> Edit</button>}
      </div>
      {focus && <div className="text-xs rounded-lg px-3 py-2 mb-3 flex items-start gap-2" style={{ background: tint('var(--accent-primary)', 8) }}><Target size={13} className="text-accent shrink-0 mt-0.5" /><span><b>This week’s focus:</b> {focus}</span></div>}
      {!plan ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-mute flex-1 min-w-[14rem]">No plan for today yet. Two minutes before the open: bias, instruments, allowed setups, max trades and max loss. Trades beyond it are tagged off-plan.</p>
          <Button onClick={() => setOpen(true)}>Plan today’s session</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ps.stop && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 text-bad" style={{ background: tint('var(--error)', 10), border: `1px solid ${tint('var(--error)', 40)}` }}>
              <OctagonX size={16} className="shrink-0" /> <span><b>Stop trading for today</b> — {ps.reasons.join(' and ')}. That is what you planned.</span>
            </div>
          )}
          <div className="grid sm:grid-cols-4 gap-3 text-sm">
            <div><div className="text-[11px] text-mute">Bias</div><div className="font-medium">{bias || '—'}</div></div>
            <div><div className="text-[11px] text-mute">Instruments</div><div className="font-medium truncate">{plan.instruments?.join(', ') || 'any'}</div></div>
            <div>
              <div className="text-[11px] text-mute">Trades {ps.tradesUsed}{ps.maxTrades ? ` / ${ps.maxTrades}` : ''}</div>
              {ps.maxTrades ? <ProgressBar value={Math.min(100, (ps.tradesUsed / ps.maxTrades) * 100)} height={5} color={ps.tradesUsed >= ps.maxTrades ? 'var(--error)' : 'var(--accent-primary)'} /> : <div className="font-medium">no cap</div>}
            </div>
            <div>
              <div className="text-[11px] text-mute">Loss {fmtMoney(ps.lossUsed, 0, currency)}{ps.maxLoss ? ` / ${fmtMoney(ps.maxLoss, 0, currency)}` : ''}</div>
              {ps.maxLoss ? <ProgressBar value={Math.min(100, (ps.lossUsed / ps.maxLoss) * 100)} height={5} color={ps.lossUsed >= ps.maxLoss ? 'var(--error)' : ps.lossUsed >= ps.maxLoss * 0.7 ? 'var(--warning)' : 'var(--success)'} /> : <div className="font-medium">no cap</div>}
            </div>
          </div>
          {plan.setups?.length > 0 && <div className="text-xs text-mute">Allowed setups: <span className="text-ink">{plan.setups.join(', ')}</span></div>}
          {(plan.levels || plan.news || plan.notes) && (
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              {plan.levels && <div className="whitespace-pre-line"><div className="text-mute mb-0.5">Levels</div>{plan.levels}</div>}
              {plan.news && <div className="whitespace-pre-line"><div className="text-mute mb-0.5">News</div>{plan.news}</div>}
              {plan.notes && <div><div className="text-mute mb-0.5">Notes</div>{plan.notes}</div>}
            </div>
          )}
        </div>
      )}
      <PlanModal open={open} onClose={() => setOpen(false)} accountId={accountId} day={today} instruments={instruments} strategies={strategies} currency={currency} suggestedMaxLoss={suggestedMaxLoss} />
    </Card>
  );
}

// ── End-of-day review ──
function SummaryLine({ s, currency }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span><span className="text-mute text-xs">Trades</span> <b>{s.count}</b></span>
      <span><span className="text-mute text-xs">P&L</span> <b style={{ color: s.pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmtSignedMoney(s.pnl, currency)}</b></span>
      <span><span className="text-mute text-xs">R</span> <b>{fmtR(s.sumR)}</b></span>
      {s.winRate != null && <span><span className="text-mute text-xs">Win rate</span> <b>{fmtPct(s.winRate)}</b></span>}
      {s.onPlanPct != null && <span><span className="text-mute text-xs">On plan</span> <b>{Math.round(s.onPlanPct)}%</b></span>}
      {s.topMistake && <span><span className="text-mute text-xs">Costliest mistake</span> <b className="text-bad">{s.topMistake.label}</b></span>}
    </div>
  );
}

function addLessonCard(day, lesson) {
  const fc = useFlashcardStore.getState();
  const deckId = fc.decks.find((d) => d.name === LESSON_DECK)?.id || fc.addDeck({ name: LESSON_DECK, description: 'Lessons from my trading reviews' });
  fc.addCard({ deckId, front: `Trading lesson (${fmtDate(day)}) — what must I remember?`, back: lesson });
  toast('Lesson added to your flashcards (Learning › Révisions)', 'success');
}

export function DayReviewCard({ accountId, todayTrades, currency }) {
  const { dayReviews, saveDayReview } = useTradingStore();
  const today = todayKey();
  const review = (dayReviews || {})[routineKey(accountId, today)];
  const s = useMemo(() => periodSummary(todayTrades), [todayTrades]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(null);
  const start = () => { setF({ grade: review?.grade || '', followedPlan: review?.followedPlan ?? (s.onPlanPct == null ? null : s.onPlanPct === 100), wentWell: review?.wentWell || '', improve: review?.improve || '', lesson: review?.lesson || '', toCard: false }); setOpen(true); };
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Moon size={16} className="text-accent" />
        <span className="text-sm font-semibold flex-1">End-of-day review</span>
        {review && <button className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={start}><Pencil size={12} /> Edit</button>}
      </div>
      <SummaryLine s={s} currency={currency} />
      {review ? (
        <div className="flex items-start gap-3 mt-3">
          <GradeBadge g={review.grade} />
          <div className="text-sm space-y-0.5 min-w-0">
            <div className="text-xs text-mute">{review.followedPlan === true ? 'Plan followed' : review.followedPlan === false ? 'Plan not followed' : ''}</div>
            {review.wentWell && <div><span className="text-good">+</span> {review.wentWell}</div>}
            {review.improve && <div><span className="text-bad">−</span> {review.improve}</div>}
            {review.lesson && <div className="text-mute italic">“{review.lesson}”</div>}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <p className="text-xs text-mute flex-1 min-w-[12rem]">{todayTrades.length ? 'Grade your day while it’s fresh — process, not P&L.' : 'No trades today? A disciplined day off is worth reviewing too.'}</p>
          <Button variant="secondary" onClick={start}>Review today</Button>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Review · ${fmtDate(today)}`} wide>
        {f && (
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!f.grade) return toast('Pick a grade', 'error');
            const { toCard, ...data } = f;
            saveDayReview(accountId, today, data);
            if (toCard && f.lesson.trim()) addLessonCard(today, f.lesson.trim());
            setOpen(false);
          }}>
            <div className="rounded-lg border border-line p-3"><SummaryLine s={s} currency={currency} /></div>
            <Field label="Grade your process (not the P&L)"><GradePicker value={f.grade} onChange={(g) => setF((p) => ({ ...p, grade: g }))} /></Field>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1">Did I follow my plan today?</span>
              {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
                <button key={o.l} type="button" onClick={() => setF((p) => ({ ...p, followedPlan: o.v }))}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${f.followedPlan === o.v ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute'}`}>{o.l}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="What went well"><Textarea value={f.wentWell} onChange={(e) => setF((p) => ({ ...p, wentWell: e.target.value }))} /></Field>
              <Field label="What to improve"><Textarea value={f.improve} onChange={(e) => setF((p) => ({ ...p, improve: e.target.value }))} /></Field>
            </div>
            <Field label="Lesson of the day"><Input value={f.lesson} onChange={(e) => setF((p) => ({ ...p, lesson: e.target.value }))} placeholder="e.g. No entries in the first 5 minutes after the NY open" /></Field>
            {f.lesson.trim() && (
              <label className="flex items-center gap-2 text-xs text-mute cursor-pointer">
                <input type="checkbox" className="accent-[var(--accent-primary)]" checked={f.toCard} onChange={(e) => setF((p) => ({ ...p, toCard: e.target.checked }))} />
                Add this lesson to my flashcards (Learning › Révisions, deck “{LESSON_DECK}”) so I review it with spaced repetition
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Save review</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ── Weekly review ──
export function WeeklyReviewCard({ accountId, trades, currency }) {
  const { weekReviews, dayReviews, saveWeekReview } = useTradingStore();
  const today = todayKey();
  const thisWeek = weekStartOf(today);
  const [week, setWeek] = useState(thisWeek);
  const weekEnd = addDays(week, 6);
  const wTrades = useMemo(() => trades.filter((t) => t.date >= week && t.date <= weekEnd), [trades, week, weekEnd]);
  const s = useMemo(() => periodSummary(wTrades), [wTrades]);
  const review = (weekReviews || {})[routineKey(accountId, week)];
  const [f, setF] = useState(null);
  const [editing, setEditing] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const lastWeekMissing = week === thisWeek && !(weekReviews || {})[routineKey(accountId, addDays(thisWeek, -7))] && trades.some((t) => t.date >= addDays(thisWeek, -7) && t.date < thisWeek);
  const history = Object.entries(weekReviews || {}).filter(([k]) => k.startsWith(`${accountId}|`)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 8);
  const startEdit = () => { setF({ grade: review?.grade || '', worked: review?.worked || '', fix: review?.fix || '', focusNext: review?.focusNext || '' }); setEditing(true); };
  const showForm = editing || (!review && (s.count > 0 || week < thisWeek));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <CalendarRange size={16} className="text-accent" />
        <span className="text-sm font-semibold flex-1">Weekly review</span>
        <button className="p-1 text-mute hover:text-ink cursor-pointer" onClick={() => { setWeek(addDays(week, -7)); setEditing(false); }} title="Previous week"><ChevronLeft size={15} /></button>
        <span className="text-xs text-mute tabular-nums">{fmtDate(week).replace(/ \d{4}$/, '')} → {fmtDate(weekEnd)}</span>
        <button className="p-1 text-mute hover:text-ink cursor-pointer disabled:opacity-30" disabled={week >= thisWeek} onClick={() => { setWeek(addDays(week, 7)); setEditing(false); }} title="Next week"><ChevronRight size={15} /></button>
      </div>
      {lastWeekMissing && (
        <button className="w-full text-left text-xs rounded-lg px-3 py-2 mb-3 cursor-pointer text-warn" style={{ background: tint('var(--warning)', 10) }} onClick={() => setWeek(addDays(thisWeek, -7))}>
          Last week isn’t reviewed yet — review it now →
        </button>
      )}
      <SummaryLine s={s} currency={currency} />
      {(s.best || s.worst) && (
        <div className="text-xs text-mute mt-1.5 flex flex-wrap gap-x-4">
          {s.best && <span>Best setup: <b className="text-good">{s.best.name}</b> {fmtSignedMoney(s.best.pnl, currency)}</span>}
          {s.worst && <span>Worst setup: <b className="text-bad">{s.worst.name}</b> {fmtSignedMoney(s.worst.pnl, currency)}</span>}
        </div>
      )}
      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {days.map((d) => {
          const ts = wTrades.filter((t) => t.date === d);
          const pnl = ts.reduce((a, t) => a + t.pnl, 0);
          const g = (dayReviews || {})[routineKey(accountId, d)]?.grade;
          return (
            <div key={d} className="rounded-lg border border-line px-1 py-1.5 text-center">
              <div className="text-[10px] text-mute">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][days.indexOf(d)]}</div>
              <div className="text-[11px] font-semibold tabular-nums" style={{ color: !ts.length ? 'var(--text-secondary)' : pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>{ts.length ? fmtSignedMoney(pnl, currency).replace(/\.\d+/, '') : '—'}</div>
              <div className="h-5 flex items-center justify-center">{g ? <GradeBadge g={g} size="sm" /> : null}</div>
            </div>
          );
        })}
      </div>

      {review && !editing && (
        <div className="flex items-start gap-3 mt-4">
          <GradeBadge g={review.grade} />
          <div className="text-sm space-y-0.5 min-w-0 flex-1">
            {review.worked && <div><span className="text-good">Worked:</span> {review.worked}</div>}
            {review.fix && <div><span className="text-bad">Fix:</span> {review.fix}</div>}
            {review.focusNext && <div><span className="text-accent">Focus next week:</span> {review.focusNext}</div>}
          </div>
          <button className="p-1 text-mute hover:text-accent cursor-pointer" onClick={startEdit} title="Edit review"><Pencil size={13} /></button>
        </div>
      )}
      {showForm && !(review && !editing) && (
        <WeekForm f={f || EMPTY_WEEK} setF={(fn) => setF((p) => fn(p || EMPTY_WEEK))}
          onCancel={editing ? () => setEditing(false) : null}
          onSave={(data) => { if (!data.grade) return toast('Pick a grade', 'error'); saveWeekReview(accountId, week, data); setEditing(false); setF(null); }} />
      )}
      {!review && !showForm && <p className="text-xs text-mute mt-3">No trades yet this week — the review opens once you have trades (or at the end of the week).</p>}

      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-mute">Past weeks</span>
          {history.map(([k, r]) => {
            const ws = k.split('|')[1];
            return (
              <button key={k} onClick={() => { setWeek(ws); setEditing(false); }} className="flex items-center gap-1 text-[11px] text-mute hover:text-ink cursor-pointer" title={r.focusNext || ''}>
                <GradeBadge g={r.grade} size="sm" /> {fmtDate(ws).replace(/ \d{4}$/, '')}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function WeekForm({ f, setF, onSave, onCancel }) {
  return (
    <form className="space-y-3 mt-4 pt-3 border-t border-line" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <Field label="Grade the week (process)"><GradePicker value={f.grade} onChange={(g) => setF((p) => ({ ...p, grade: g }))} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="What worked"><Textarea value={f.worked} onChange={(e) => setF((p) => ({ ...p, worked: e.target.value }))} /></Field>
        <Field label="What to fix"><Textarea value={f.fix} onChange={(e) => setF((p) => ({ ...p, fix: e.target.value }))} /></Field>
      </div>
      <Field label="One focus for next week" hint="Shown on your session plan all next week"><Input value={f.focusNext} onChange={(e) => setF((p) => ({ ...p, focusNext: e.target.value }))} placeholder="e.g. Max 2 trades a day, A+ setups only" /></Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit">Save weekly review</Button>
      </div>
    </form>
  );
}
