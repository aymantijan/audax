import { useEffect, useState } from 'react';
import { useTradingStore } from '../../store/tradingStore';
import { Button, Field, Input, Select, Modal } from '../common/ui';

const blank = () => ({
  type: 'demo',
  name: '',
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
});

const TYPE_OPTIONS = [
  { value: 'demo', label: 'Demo — simulated, no real capital' },
  { value: 'broker', label: 'Broker — your own real capital' },
  { value: 'propfirm', label: 'Prop Firm — evaluation or funded' },
];

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
        broker: form.broker,
        accountNumber: form.accountNumber,
        leverage: form.leverage,
        initialBalance: form.initialBalance,
        propFirmRules:
          form.type === 'propfirm'
            ? {
                maxDailyLossPct: form.maxDailyLossPct,
                maxTotalDrawdownPct: form.maxTotalDrawdownPct,
                profitTargetPct: form.profitTargetPct,
                minTradingDays: form.minTradingDays,
                consistencyRulePct: form.consistencyRulePct,
              }
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
          <Field label="Starting balance ($)">
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
