import { useEffect, useState } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { CURRENCIES } from '../../utils/constants';
import { Button, Field, Input, Select, Modal } from '../common/ui';
import { PROP_FIRM_PRESETS, PRESETS_CHECKED_AT, presetById, presetLabel, presetRulesFor } from '../../utils/prop-firm-presets';

const numOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const RULE_KEYS = ['maxDailyLossPct', 'maxTotalDrawdownPct', 'profitTargetPct', 'minTradingDays', 'consistencyRulePct', 'maxPhaseDurationDays', 'minDayProfitPct', 'maxDailyProfitAmount'];

const blank = () => ({
  type: 'demo',
  name: '',
  currency: 'USD',
  broker: '',
  accountNumber: '',
  leverage: '',
  initialBalance: '',
  startFunded: false,
  maxDailyLossPct: '',
  maxTotalDrawdownPct: '',
  profitTargetPct: '',
  minTradingDays: '',
  consistencyRulePct: '',
  maxPhaseDurationDays: '',
  maxTotalDrawdownType: 'trailing',
  minDayProfitPct: '',
  maxDailyProfitAmount: '',
  rulePreset: '',
  riskMaxDailyLossPct: '',
  riskMaxTotalDrawdownPct: '',
});

const TYPE_OPTIONS = [
  { value: 'demo', label: 'Demo — simulated, no real capital' },
  { value: 'broker', label: 'Broker — your own real capital' },
  { value: 'propfirm', label: 'Prop Firm — evaluation or funded' },
];

// One click fills the rules of the chosen firm/program for the account's phase;
// with a preset stored on the account, advancing a phase applies the next rules.
function PresetPicker({ form, setForm, phase }) {
  const preset = presetById(form.rulePreset);
  const apply = (id) => {
    const p = presetById(id);
    if (!p) return setForm({ ...form, rulePreset: '' });
    const r = presetRulesFor(p, phase) || {};
    setForm({
      ...form, rulePreset: id, broker: form.broker || p.firm,
      ...Object.fromEntries(RULE_KEYS.map((k) => [k, r[k] ?? ''])),
      maxTotalDrawdownType: r.maxTotalDrawdownType || 'trailing',
    });
  };
  return (
    <div className="rounded-lg border border-line p-3 space-y-2">
      <Field label="Fill from a firm preset (optional)">
        <Select value={form.rulePreset} onChange={(e) => apply(e.target.value)}
          options={[{ value: '', label: '— Enter the rules myself —' }, ...PROP_FIRM_PRESETS.map((p) => ({ value: p.id, label: presetLabel(p) }))]} />
      </Field>
      {preset && (
        <div className="text-[11px] text-mute space-y-1">
          <div>{preset.notes}</div>
          <div>
            Checked on {PRESETS_CHECKED_AT} on the <a href={preset.source} target="_blank" rel="noopener noreferrer" className="text-accent underline">official page</a> — firms change their rules: confirm yours. Next phases get their own rules automatically when you advance.
          </div>
        </div>
      )}
    </div>
  );
}

// Create/edit any account type. Type is locked once an account exists — changing
// it after the fact would make its rule-tracking history incoherent.
export default function AccountFormModal({ open, onClose, account }) {
  const { addAccount, editAccount } = useTradingStore();
  const [form, setForm] = useState(blank());
  const isEdit = !!account;

  useEffect(() => {
    if (!open) return;
    setForm(
      account
        ? {
            ...blank(),
            type: account.type,
            name: account.name,
            currency: account.currency || 'USD',
            broker: account.broker || '',
            accountNumber: account.accountNumber || '',
            leverage: account.leverage || '',
            initialBalance: account.initialBalance,
            startFunded: account.phase === 'funded',
            maxDailyLossPct: account.propFirmRules?.maxDailyLossPct ?? '',
            maxTotalDrawdownPct: account.propFirmRules?.maxTotalDrawdownPct ?? '',
            profitTargetPct: account.propFirmRules?.profitTargetPct ?? '',
            minTradingDays: account.propFirmRules?.minTradingDays ?? '',
            consistencyRulePct: account.propFirmRules?.consistencyRulePct ?? '',
            maxPhaseDurationDays: account.propFirmRules?.maxPhaseDurationDays ?? '',
            maxTotalDrawdownType: account.propFirmRules?.maxTotalDrawdownType || 'trailing',
            minDayProfitPct: account.propFirmRules?.minDayProfitPct ?? '',
            maxDailyProfitAmount: account.propFirmRules?.maxDailyProfitAmount ?? '',
            rulePreset: account.rulePreset || '',
            riskMaxDailyLossPct: account.riskLimits?.maxDailyLossPct ?? '',
            riskMaxTotalDrawdownPct: account.riskLimits?.maxTotalDrawdownPct ?? '',
          }
        : blank()
    );
  }, [open, account]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !Number(form.initialBalance)) return;
    if (isEdit) {
      editAccount(account.id, {
        name: form.name,
        currency: form.currency,
        broker: form.broker,
        accountNumber: form.accountNumber,
        leverage: form.leverage,
        initialBalance: form.initialBalance,
        // Numbers or null — an empty field used to be saved as '' and read as 0 by the rules engine.
        propFirmRules:
          form.type === 'propfirm'
            ? { ...Object.fromEntries(RULE_KEYS.map((k) => [k, numOrNull(form[k])])), maxTotalDrawdownType: form.maxTotalDrawdownType }
            : undefined,
        rulePreset: form.type === 'propfirm' ? form.rulePreset || null : null,
        riskLimits:
          form.type !== 'propfirm' && (form.riskMaxDailyLossPct || form.riskMaxTotalDrawdownPct)
            ? { maxDailyLossPct: form.riskMaxDailyLossPct, maxTotalDrawdownPct: form.riskMaxTotalDrawdownPct }
            : undefined,
      });
    } else {
      addAccount(form);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${account.name}` : 'New Trading Account'} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TYPE_OPTIONS} disabled={isEdit} />
          </Field>
          <Field label="Account name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === 'propfirm' ? 'e.g. FTMO 100k' : 'e.g. Main Broker'} autoFocus required />
          </Field>
          <Field label={form.type === 'propfirm' ? 'Prop firm name' : 'Broker'}>
            <Input value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder={form.type === 'propfirm' ? 'e.g. FTMO' : 'e.g. Interactive Brokers'} />
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} options={CURRENCIES} />
          </Field>
          <Field label="Starting balance">
            <Input type="number" step="any" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} required />
          </Field>
          {form.type === 'broker' && (
            <>
              <Field label="Account number (optional)">
                <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </Field>
              <Field label="Leverage (optional)">
                <Input type="number" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} placeholder="e.g. 30" />
              </Field>
            </>
          )}
        </div>

        {form.type === 'propfirm' && (
          <div className="border-t border-line pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-mute uppercase tracking-wide">Firm Rules (enter your firm's actual terms — leave blank to skip a check)</h4>
            <PresetPicker form={form} setForm={setForm} phase={isEdit ? account.phase || 'phase1' : form.startFunded ? 'funded' : 'phase1'} />
            {!isEdit && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.startFunded} onChange={(e) => setForm({ ...form, startFunded: e.target.checked })} />
                This account is already funded (skip the evaluation phases)
              </label>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Max daily loss (%)">
                <Input type="number" step="0.1" value={form.maxDailyLossPct} onChange={(e) => setForm({ ...form, maxDailyLossPct: e.target.value })} placeholder="e.g. 5" />
              </Field>
              <Field label="Max total drawdown (%)">
                <Input type="number" step="0.1" value={form.maxTotalDrawdownPct} onChange={(e) => setForm({ ...form, maxTotalDrawdownPct: e.target.value })} placeholder="e.g. 10" />
              </Field>
              {!form.startFunded && (
                <Field label="Profit target this phase (%)">
                  <Input type="number" step="0.1" value={form.profitTargetPct} onChange={(e) => setForm({ ...form, profitTargetPct: e.target.value })} placeholder="e.g. 8" />
                </Field>
              )}
              <Field label="Min trading days">
                <Input type="number" value={form.minTradingDays} onChange={(e) => setForm({ ...form, minTradingDays: e.target.value })} placeholder="e.g. 4" />
              </Field>
              <Field label="Consistency rule (%)" hint="Max % of profit from a single day">
                <Input type="number" step="0.1" value={form.consistencyRulePct} onChange={(e) => setForm({ ...form, consistencyRulePct: e.target.value })} placeholder="e.g. 30" />
              </Field>
              <Field label="Phase time limit (days)" hint="Leave blank if the firm gives unlimited time">
                <Input type="number" value={form.maxPhaseDurationDays} onChange={(e) => setForm({ ...form, maxPhaseDurationDays: e.target.value })} placeholder="e.g. 30" />
              </Field>
              <Field label="Max loss measured">
                <Select value={form.maxTotalDrawdownType} onChange={(e) => setForm({ ...form, maxTotalDrawdownType: e.target.value })} options={[{ value: 'static', label: 'Static — from the starting balance' }, { value: 'trailing', label: 'Trailing — from the highest balance' }]} />
              </Field>
              <Field label="Min profit for a day to count (%)" hint="e.g. 0.5 at Goat Funded · 0 = any profitable day · blank = any day traded">
                <Input type="number" step="0.1" value={form.minDayProfitPct} onChange={(e) => setForm({ ...form, minDayProfitPct: e.target.value })} />
              </Field>
              <Field label="Max profit per day (amount)" hint="Optional cap, e.g. $3,000 funded at Goat">
                <Input type="number" step="any" value={form.maxDailyProfitAmount} onChange={(e) => setForm({ ...form, maxDailyProfitAmount: e.target.value })} />
              </Field>
            </div>
          </div>
        )}

        {form.type !== 'propfirm' && (
          <div className="border-t border-line pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-mute uppercase tracking-wide">Risk Limits (optional — same discipline check prop-firm accounts get)</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max daily loss (%)">
                <Input type="number" step="0.1" value={form.riskMaxDailyLossPct} onChange={(e) => setForm({ ...form, riskMaxDailyLossPct: e.target.value })} placeholder="e.g. 5" />
              </Field>
              <Field label="Max total drawdown (%)">
                <Input type="number" step="0.1" value={form.riskMaxTotalDrawdownPct} onChange={(e) => setForm({ ...form, riskMaxTotalDrawdownPct: e.target.value })} placeholder="e.g. 15" />
              </Field>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{isEdit ? 'Save changes' : 'Create account'}</Button>
        </div>
      </form>
    </Modal>
  );
}
