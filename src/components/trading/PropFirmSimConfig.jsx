import { useState } from 'react';
import { AlertTriangle, CheckCircle2, GraduationCap } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { Card, Button, Field, Input, Select, Badge, EmptyState } from '../common/ui';
import RuleGauge from './RuleGauge';
import { toast } from '../../store/uiStore';

const PHASE_NUMBERS = [1, 2, 3];

const blankPhaseForm = () => ({
  profitTargetPct: '', maxDailyLossPct: '', maxTotalDrawdownPct: '', maxTotalDrawdownType: 'trailing',
  minTradingDays: '', consistencyRulePct: '', maxDailyProfitAmount: '', maxPhaseDurationDays: '',
});

function PhaseRuleForm({ n, value, onChange }) {
  return (
    <div className="border border-line rounded-lg p-3 space-y-3">
      <div className="text-xs font-semibold text-mute uppercase tracking-wide">Phase {n} rules</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Profit target (%)">
          <Input type="number" step="0.1" value={value.profitTargetPct} onChange={(e) => onChange({ ...value, profitTargetPct: e.target.value })} placeholder="e.g. 8" />
        </Field>
        <Field label="Max daily loss (%)">
          <Input type="number" step="0.1" value={value.maxDailyLossPct} onChange={(e) => onChange({ ...value, maxDailyLossPct: e.target.value })} placeholder="e.g. 5" />
        </Field>
        <Field label="Max overall loss (%)">
          <Input type="number" step="0.1" value={value.maxTotalDrawdownPct} onChange={(e) => onChange({ ...value, maxTotalDrawdownPct: e.target.value })} placeholder="e.g. 10" />
        </Field>
        <Field label="Overall loss type">
          <Select
            value={value.maxTotalDrawdownType}
            onChange={(e) => onChange({ ...value, maxTotalDrawdownType: e.target.value })}
            options={[{ value: 'trailing', label: 'Trailing (from peak equity)' }, { value: 'static', label: 'Static (from starting balance)' }]}
          />
        </Field>
        <Field label="Min trading days">
          <Input type="number" value={value.minTradingDays} onChange={(e) => onChange({ ...value, minTradingDays: e.target.value })} placeholder="e.g. 4" />
        </Field>
        <Field label="Consistency rule (%)" hint="Max % of profit from a single day">
          <Input type="number" step="0.1" value={value.consistencyRulePct} onChange={(e) => onChange({ ...value, consistencyRulePct: e.target.value })} placeholder="e.g. 30" />
        </Field>
        <Field label="Max daily profit ($)" hint="Leave blank for no limit">
          <Input type="number" step="any" min="0" value={value.maxDailyProfitAmount} onChange={(e) => onChange({ ...value, maxDailyProfitAmount: e.target.value })} placeholder="e.g. 3000" />
        </Field>
        <Field label="Phase time limit (days)" hint="Leave blank for unlimited time">
          <Input type="number" value={value.maxPhaseDurationDays} onChange={(e) => onChange({ ...value, maxPhaseDurationDays: e.target.value })} placeholder="e.g. 30" />
        </Field>
      </div>
    </div>
  );
}

function ConfigForm({ account, onDone }) {
  const setSimPhases = useTradingStore((s) => s.setSimPhases);
  const [checked, setChecked] = useState(() => {
    const n = account.simPhases?.length || 1;
    return { 1: n >= 1, 2: n >= 2, 3: n >= 3 };
  });
  const [forms, setForms] = useState(() => {
    const out = { 1: blankPhaseForm(), 2: blankPhaseForm(), 3: blankPhaseForm() };
    (account.simPhases || []).forEach((p, i) => { out[i + 1] = { ...blankPhaseForm(), ...p }; });
    return out;
  });

  const submit = (e) => {
    e.preventDefault();
    const phases = PHASE_NUMBERS.filter((n) => checked[n]).map((n) => {
      const f = forms[n];
      const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
      return {
        profitTargetPct: numOrNull(f.profitTargetPct), maxDailyLossPct: numOrNull(f.maxDailyLossPct),
        maxTotalDrawdownPct: numOrNull(f.maxTotalDrawdownPct), maxTotalDrawdownType: f.maxTotalDrawdownType,
        minTradingDays: numOrNull(f.minTradingDays), consistencyRulePct: numOrNull(f.consistencyRulePct),
        maxDailyProfitAmount: numOrNull(f.maxDailyProfitAmount), maxPhaseDurationDays: numOrNull(f.maxPhaseDurationDays),
      };
    });
    const res = setSimPhases(account.id, phases);
    if (!res.ok) return toast(res.error, 'error');
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-mute">
        Simulate a real prop-firm evaluation on this Demo account — pick how many phases you want to rehearse and set each one's rules (enter your target firm's actual terms, or your own training goals). Starting/restarting resets simulation progress and history.
      </p>
      <div className="flex gap-2">
        {PHASE_NUMBERS.map((n) => (
          <label key={n} className="flex items-center gap-2 text-sm cursor-pointer border border-line rounded-lg px-3 py-1.5">
            <input type="checkbox" checked={checked[n]} onChange={(e) => setChecked({ ...checked, [n]: e.target.checked })} />
            Phase {n}
          </label>
        ))}
      </div>
      {PHASE_NUMBERS.filter((n) => checked[n]).map((n) => (
        <PhaseRuleForm key={n} n={n} value={forms[n]} onChange={(v) => setForms({ ...forms, [n]: v })} />
      ))}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!PHASE_NUMBERS.some((n) => checked[n])}>
          {account.simEnabled ? 'Save & restart simulation' : 'Start simulation'}
        </Button>
      </div>
    </form>
  );
}

export default function PropFirmSimConfig({ account }) {
  const { getSimProgress, advanceSimPhase, disableSim } = useTradingStore();
  const [configuring, setConfiguring] = useState(false);

  if (configuring || !account.simEnabled) {
    return (
      <Card title="Prop Firm Simulation" action={account.simEnabled ? <Badge color="var(--accent-primary)">Configuring</Badge> : undefined}>
        {configuring || account.simEnabled ? (
          <ConfigForm account={account} onDone={() => setConfiguring(false)} />
        ) : (
          <div className="flex items-start gap-3">
            <GraduationCap size={20} className="text-mute shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-mute mb-3">
                Train for a real prop-firm evaluation before paying for one — set up 1 to 3 phases with your own profit targets, daily/overall loss limits, min trading days, and consistency rule, and this account tracks pass/fail exactly like a funded challenge would.
              </p>
              <Button variant="secondary" onClick={() => setConfiguring(true)}>Configure simulation</Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  const progress = getSimProgress(account.id);
  const idx = account.simCurrentPhaseIndex || 0;
  const totalPhases = account.simPhases.length;
  const isLast = idx >= totalPhases - 1;

  return (
    <Card
      title={`Simulation — Phase ${idx + 1} of ${totalPhases}`}
      action={
        account.simStatus === 'active' ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfiguring(true)}>Reconfigure</Button>
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => { if (confirm('Mark this simulated phase as failed?')) advanceSimPhase(account.id, 'failed'); }}>Mark failed</Button>
            <Button
              className="!px-3 !py-1.5 text-xs"
              disabled={!progress?.readyToAdvance}
              title={progress?.readyToAdvance ? '' : 'Profit target, min days, and no rule breach required'}
              onClick={() => advanceSimPhase(account.id, 'advance')}
            >
              {isLast ? 'Complete simulation' : `Advance to Phase ${idx + 2}`}
            </Button>
          </div>
        ) : (
          <Badge color={account.simStatus === 'completed' ? 'var(--success)' : 'var(--error)'}>{account.simStatus === 'completed' ? 'Completed' : 'Failed'}</Badge>
        )
      }
    >
      {progress ? (
        <>
          <div className="space-y-3 mb-4">
            {progress.rules.maxDailyLossPct != null && <RuleGauge label="Today's loss" value={progress.dailyLossPct} max={progress.rules.maxDailyLossPct} />}
            {progress.rules.maxTotalDrawdownPct != null && <RuleGauge label={progress.rules.maxTotalDrawdownType === 'static' ? 'Overall loss (static)' : 'Max drawdown (trailing)'} value={progress.maxDrawdownPct} max={progress.rules.maxTotalDrawdownPct} />}
            {progress.rules.profitTargetPct != null && <RuleGauge label="Profit toward target" value={Math.max(0, progress.profitPct)} max={progress.rules.profitTargetPct} invert />}
            {progress.rules.minTradingDays != null && <RuleGauge label="Trading days" value={progress.tradingDays} max={progress.rules.minTradingDays} unit="" invert />}
            {progress.rules.consistencyRulePct != null && <RuleGauge label="Consistency (best day / total profit)" value={progress.consistencyPct} max={progress.rules.consistencyRulePct} />}
          </div>
          {progress.breaches.length > 0 ? (
            <div className="space-y-2">
              {progress.breaches.map((b, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${b.level === 'danger' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'}`}>
                  <AlertTriangle size={14} /> {b.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-good"><CheckCircle2 size={15} /> All rules currently respected.</div>
          )}
        </>
      ) : (
        <EmptyState>Log trades on this account to see simulation progress.</EmptyState>
      )}

      {account.simPhaseHistory?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line">
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">Simulation History</div>
          <ul className="space-y-1.5 text-sm">
            {account.simPhaseHistory.map((h, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>Phase {h.phaseIndex + 1}</span>
                <span className={h.outcome === 'passed' ? 'text-good' : 'text-bad'}>
                  {h.outcome === 'passed' ? 'Passed' : 'Failed'} · {h.snapshot.profitPct}% · {h.snapshot.tradingDays}d
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {account.simStatus !== 'active' && (
        <div className="mt-4 pt-4 border-t border-line flex gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfiguring(true)}>Run again</Button>
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => disableSim(account.id)}>Turn off simulation</Button>
        </div>
      )}
    </Card>
  );
}
