import { useEffect, useState } from 'react';
import { Target, Pencil, Trash2, Trophy } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFinanceStore } from '../../store/financeStore';
import { useTradingStore } from '../../store/tradingStore';
import { ASSET_TYPES, LIABILITY_TYPES, GOAL_TYPES } from '../../utils/constants';
import { ratioSeverity } from '../../utils/accounting';
import { fmtMAD, fmtPct, fmtDate, fmtDateShort, usdToMad } from '../../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Modal, ProgressBar, Badge, EmptyState } from '../../components/common/ui';
import EntityFormModal from '../../components/common/EntityFormModal';

const RATIO_DEFS = [
  { key: 'savingsRate', label: "Taux d'épargne", fmt: fmtPct, thresholds: { warn: 10, bad: 0, invert: true } },
  { key: 'expenseRatio', label: 'Ratio de dépenses', fmt: fmtPct, thresholds: { warn: 80, bad: 100 } },
  { key: 'currentRatio', label: 'Ratio de liquidité générale', fmt: (v) => v.toFixed(2), thresholds: { warn: 1.5, bad: 1, invert: true } },
  { key: 'debtRatio', label: "Ratio d'endettement", fmt: fmtPct, thresholds: { warn: 35, bad: 50 } },
  { key: 'solvencyRatio', label: 'Ratio de solvabilité', fmt: fmtPct, thresholds: { warn: 30, bad: 10, invert: true } },
  { key: 'fixedCostRatio', label: 'Charges fixes / revenu', fmt: fmtPct, thresholds: { warn: 40, bad: 55 } },
];

const SEV_COLOR = { red: 'var(--error)', orange: 'var(--warning)' };

export default function RatiosWealth() {
  const financeStore = useFinanceStore();
  const tradingStore = useTradingStore();
  const {
    snapshots, adjustments, goals,
    addSnapshot, addGoal, editGoal, deleteGoal,
    addAdjustment, editAdjustment, deleteAdjustment,
    checkGoalAchievement,
  } = financeStore;

  const [snapModal, setSnapModal] = useState(false);
  const [snapForm, setSnapForm] = useState({});
  const [goalModal, setGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', type: 'netWorth', targetAmount: '', targetDate: '' });
  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ type: 'Valuation', amount: '', reason: '' });
  const [editing, setEditing] = useState(null); // { kind, data }

  const ratios = financeStore.getRatios();
  const baseNetWorth = financeStore.getBaseNetWorth();
  const adjustmentsTotal = financeStore.getAdjustmentsTotal();
  const netWorth = financeStore.getNetWorth();
  const { change: momChange } = financeStore.getSnapshotMomentum();
  const goalRows = financeStore.getGoalRows({ tradingAccountValueMad: usdToMad(tradingStore.accountValue()) });

  useEffect(() => {
    for (const g of goalRows) if (g.current !== null && g.current >= g.targetAmount) checkGoalAchievement(g.id, g.current);
  }, [goalRows, checkGoalAchievement]);

  const goalEditFields = [
    { name: 'name', label: 'Goal name', type: 'text' },
    { name: 'type', label: 'Tracks', type: 'select', options: GOAL_TYPES },
    { name: 'targetAmount', label: 'Target amount', type: 'number', step: 'any', currency: 'DH' },
    { name: 'targetDate', label: 'Target date', type: 'date' },
  ];
  const adjEditFields = [
    { name: 'type', label: 'Type', type: 'select', options: ['Valuation', 'Currency', 'Hidden Asset', 'Off-Book Liability', 'Other'] },
    { name: 'amount', label: 'Amount', type: 'number', step: 'any', currency: 'DH', hint: 'Use +/- sign for direction' },
    { name: 'reason', label: 'Reason', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      <Card title="Ratios financiers">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {RATIO_DEFS.map((r) => {
            const v = ratios[r.key];
            const sev = v !== null && v !== undefined ? ratioSeverity(v, r.thresholds) : null;
            return (
              <Stat key={r.key} label={r.label} value={v !== null && v !== undefined ? r.fmt(v) : '—'} color={sev ? SEV_COLOR[sev] : undefined} />
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Net Worth Trend" className="lg:col-span-2">
          {snapshots.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={snapshots.map((s) => ({ date: fmtDateShort(s.date), netWorth: s.netWorth }))}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtMAD(v)} />
                <Line type="monotone" dataKey="netWorth" stroke="#b366ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>Take at least two snapshots to see the trend.</EmptyState>
          )}
        </Card>

        <Card title="Patrimoine">
          <div className="space-y-3 text-sm">
            <Stat label="Net worth" value={netWorth !== null ? fmtMAD(netWorth) : '—'} sub={adjustmentsTotal !== 0 ? `${fmtMAD(baseNetWorth)} base · ${adjustmentsTotal >= 0 ? '+' : ''}${fmtMAD(adjustmentsTotal)} adj.` : (momChange !== null ? `${momChange >= 0 ? '+' : ''}${fmtMAD(momChange)} vs prev` : undefined)} />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setSnapModal(true)}>Snapshot</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setAdjModal(true)}>
                <span className="flex items-center gap-2 justify-center"><Pencil size={13} /> Adjustments</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Financial Goals"
        action={
          <Button variant="ghost" onClick={() => setGoalModal(true)}>
            <span className="flex items-center gap-2"><Target size={15} /></span>
          </Button>
        }
      >
        {goalRows.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {goalRows.map((g) => (
              <div key={g.id} className="bg-surface border border-line rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium">{g.name}</div>
                    <div className="text-xs text-mute">
                      {fmtMAD(g.targetAmount)}{g.targetDate ? ` by ${fmtDate(g.targetDate)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.achieved && (
                      <Badge color="var(--success)"><span className="flex items-center gap-1"><Trophy size={11} /> {g.badge}</span></Badge>
                    )}
                    {!g.achieved && g.onTrack !== null && (
                      <Badge color={g.onTrack ? 'var(--success)' : 'var(--error)'}>{g.onTrack ? 'on track' : 'off pace'}</Badge>
                    )}
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing({ kind: 'goal', data: g })} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete goal "${g.name}"?`)) deleteGoal(g.id); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {g.progress !== null ? (
                  <>
                    <ProgressBar value={g.progress} color={g.progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                    <div className="text-[11px] text-mute mt-1.5">
                      {fmtMAD(g.current)} of {fmtMAD(g.targetAmount)} ({Math.round(g.progress)}%)
                      {g.achieved && g.xpAwarded ? ` · achieved ${fmtDate(g.achievedAt)} · +${g.xpAwarded} XP` : (g.projected !== null && ` · pace projects ${fmtMAD(g.projected)} by target date`)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-mute">Take a net worth snapshot to start tracking progress.</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No goals set yet.</EmptyState>
        )}
      </Card>

      {/* Goal modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="Add Financial Goal">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!goalForm.name.trim() || !Number(goalForm.targetAmount)) return;
            addGoal(goalForm);
            setGoalModal(false);
            setGoalForm({ name: '', type: 'netWorth', targetAmount: '', targetDate: '' });
          }}
        >
          <Field label="Goal name">
            <Input value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder='e.g. "Reach $100k net worth"' autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tracks">
              <Select value={goalForm.type} onChange={(e) => setGoalForm({ ...goalForm, type: e.target.value })} options={GOAL_TYPES} />
            </Field>
            <Field label="Target amount (DH)">
              <Input type="number" step="any" value={goalForm.targetAmount} onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })} />
            </Field>
            <Field label="Target date">
              <Input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setGoalModal(false)}>Cancel</Button>
            <Button type="submit">Set goal</Button>
          </div>
        </form>
      </Modal>

      {/* Net worth adjustments modal */}
      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Net Worth Adjustments">
        <div className="space-y-4">
          <div className="text-sm text-mute">
            Real wealth often lives off the balance sheet — private stakes, art, hardware-wallet crypto. Add adjustments here; they're summed into your total net worth.
          </div>
          <div className="text-sm">
            Base: <span className="text-ink font-medium">{fmtMAD(baseNetWorth || 0)}</span>{' '}
            · Adjustments: <span className="font-medium" style={{ color: adjustmentsTotal >= 0 ? 'var(--success)' : 'var(--error)' }}>{adjustmentsTotal >= 0 ? '+' : ''}{fmtMAD(adjustmentsTotal)}</span>
            {' '}· Total: <span className="text-ink font-semibold">{netWorth !== null ? fmtMAD(netWorth) : '—'}</span>
          </div>
          {adjustments.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm border border-line rounded-lg px-3 py-2">
                  <Badge color="var(--accent-secondary)">{a.type}</Badge>
                  <span className="flex-1 text-mute truncate">{a.reason}</span>
                  <span className="font-medium" style={{ color: a.amount >= 0 ? 'var(--success)' : 'var(--error)' }}>{a.amount >= 0 ? '+' : ''}{fmtMAD(a.amount)}</span>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => { setAdjModal(false); setEditing({ kind: 'adjustment', data: a }); }} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this adjustment?')) deleteAdjustment(a.id); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            className="grid grid-cols-3 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!Number(adjForm.amount)) return;
              addAdjustment(adjForm);
              setAdjForm({ type: 'Valuation', amount: '', reason: '' });
            }}
          >
            <Field label="Type">
              <Select value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })} options={['Valuation', 'Currency', 'Hidden Asset', 'Off-Book Liability', 'Other']} />
            </Field>
            <Field label="Amount (DH)">
              <Input type="number" step="any" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} placeholder="+/-" />
            </Field>
            <Field label="Reason">
              <Input value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="e.g. private stake" />
            </Field>
            <Button type="submit" variant="secondary" className="col-span-3">Add adjustment</Button>
          </form>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setAdjModal(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Net worth snapshot modal */}
      <Modal open={snapModal} onClose={() => setSnapModal(false)} title="Net Worth Snapshot">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const assets = Object.fromEntries(ASSET_TYPES.map((a) => [a.key, snapForm[a.key] || 0]));
            const liabilities = Object.fromEntries(LIABILITY_TYPES.map((l) => [l.key, snapForm[l.key] || 0]));
            addSnapshot(assets, liabilities);
            setSnapModal(false);
            setSnapForm({});
          }}
        >
          <div className="text-xs font-semibold text-mute uppercase tracking-wide">Assets</div>
          <div className="grid grid-cols-2 gap-3">
            {ASSET_TYPES.map((a) => (
              <Field key={a.key} label={a.label}>
                <Input type="number" step="any" value={snapForm[a.key] || ''} onChange={(e) => setSnapForm({ ...snapForm, [a.key]: e.target.value })} placeholder="0" />
              </Field>
            ))}
          </div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide pt-2">Liabilities</div>
          <div className="grid grid-cols-2 gap-3">
            {LIABILITY_TYPES.map((l) => (
              <Field key={l.key} label={l.label}>
                <Input type="number" step="any" value={snapForm[l.key] || ''} onChange={(e) => setSnapForm({ ...snapForm, [l.key]: e.target.value })} placeholder="0" />
              </Field>
            ))}
          </div>
          <div className="text-sm text-mute">
            Net worth:{' '}
            <span className="text-ink font-semibold">
              {fmtMAD(
                ASSET_TYPES.reduce((a, t) => a + (Number(snapForm[t.key]) || 0), 0) -
                  LIABILITY_TYPES.reduce((a, t) => a + (Number(snapForm[t.key]) || 0), 0)
              )}
            </span>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setSnapModal(false)}>Cancel</Button>
            <Button type="submit">Save snapshot</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing.kind === 'goal' ? 'Edit goal' : 'Edit adjustment'}
          fields={editing.kind === 'goal' ? goalEditFields : adjEditFields}
          initial={editing.data}
          onSave={(values) => (editing.kind === 'goal' ? editGoal(editing.data.id, values) : editAdjustment(editing.data.id, values))}
          onDelete={() => (editing.kind === 'goal' ? deleteGoal(editing.data.id) : deleteAdjustment(editing.data.id))}
        />
      )}
    </div>
  );
}
