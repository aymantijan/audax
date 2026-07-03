import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTradingStore } from '../../store/tradingStore';
import { fmtMoney } from '../../utils/formatters';
import { Button, Field, Input, Modal } from './ui';

// Demo/Real trading account toggle + balance. Real account is created on first switch.
export default function AccountSwitcher({ compact = false }) {
  const user = useAuthStore((s) => s.user);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const createRealAccount = useAuthStore((s) => s.createRealAccount);
  const trades = useTradingStore((s) => s.trades);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ initialBalance: '', brokerName: 'Interactive Brokers', accountNumber: '', leverage: '30', ack: false });

  const active = user?.activeAccount || 'demo';
  const hasReal = !!user?.accounts?.real;

  const balance = useMemo(() => {
    const acct = user?.accounts?.[active];
    const initial = acct?.initialBalance ?? 52000;
    return initial + trades.filter((t) => t.accountType === active).reduce((a, t) => a + t.pnl, 0);
  }, [user, active, trades]);

  const pick = (type) => {
    if (type === 'real' && !hasReal) return setModal(true);
    setActiveAccount(type);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.ack || !Number(form.initialBalance) || !form.brokerName.trim()) return;
    createRealAccount(form);
    setModal(false);
  };

  const Pill = ({ type, label }) => (
    <button
      onClick={() => pick(type)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
        active === type ? 'bg-accent text-black' : 'text-mute hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className={`flex items-center gap-3 ${compact ? '' : 'bg-card border border-line rounded-xl px-4 py-2'}`}>
        <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-0.5">
          <Pill type="demo" label="Demo" />
          <Pill type="real" label={hasReal ? 'Real' : 'Real +'} />
        </div>
        <div className="text-sm">
          <span className="text-mute">Balance: </span>
          <span className="font-semibold" style={{ color: active === 'real' ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
            {fmtMoney(balance)}
          </span>
          <span className="text-mute text-xs"> ({active})</span>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Real Account">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-start gap-2 text-sm bg-warn/10 border border-warn/40 rounded-lg p-3 text-warn">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>Real trading risks real capital. Log honestly — this account drives your true P&L and burn-rate warnings.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting balance ($)">
              <Input type="number" step="any" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} autoFocus />
            </Field>
            <Field label="Broker">
              <Input value={form.brokerName} onChange={(e) => setForm({ ...form, brokerName: e.target.value })} />
            </Field>
            <Field label="Account number (optional)">
              <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
            </Field>
            <Field label="Leverage (e.g. 30)">
              <Input type="number" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-mute cursor-pointer">
            <input type="checkbox" checked={form.ack} onChange={(e) => setForm({ ...form, ack: e.target.checked })} />
            I understand real trading involves real financial risk.
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.ack}>Create real account</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
