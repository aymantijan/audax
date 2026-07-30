import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Settings2 } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { fmtMoney } from '../../utils/formatters';
import AccountFormModal from '../trading/AccountFormModal';

const TYPE_LABEL = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' };
const STATUS_COLOR = {
  active: 'var(--accent-primary)', funded: 'var(--success)', passed: 'var(--success)',
  failed: 'var(--error)', archived: 'var(--text-secondary)',
};

// Multi-account switcher: any number of Demo / Broker / Prop Firm accounts,
// grouped, with quick balance display and a "+ New account" shortcut.
export default function AccountSwitcher({ compact = false }) {
  const { accounts, activeAccountId, setActiveAccount, accountValue } = useTradingStore();
  const [open, setOpen] = useState(false);
  const [createModal, setCreateModal] = useState(false);

  const active = accounts.find((a) => a.id === activeAccountId);
  const visible = accounts.filter((a) => a.status !== 'archived');
  const grouped = ['demo', 'broker', 'propfirm'].map((type) => ({ type, items: visible.filter((a) => a.type === type) })).filter((g) => g.items.length);

  const pick = (id) => {
    setActiveAccount(id);
    setOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-3 cursor-pointer ${compact ? '' : 'bg-card border border-line rounded-xl px-4 py-2'}`}
        >
          {active ? (
            <>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${STATUS_COLOR[active.status]} 15%, transparent)`, color: STATUS_COLOR[active.status] }}>
                {TYPE_LABEL[active.type]}
              </span>
              <span className="text-sm">
                <span className="font-semibold">{active.name}</span>
                <span className="text-mute"> · {fmtMoney(accountValue(active.id), 0, active.currency)}</span>
              </span>
            </>
          ) : (
            <span className="text-sm text-mute">No account</span>
          )}
          <ChevronDown size={14} className="text-mute" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-80 bg-card border border-line rounded-xl shadow-2xl z-50 p-2 max-h-96 overflow-y-auto">
              {grouped.map((g) => (
                <div key={g.type} className="mb-2 last:mb-0">
                  <div className="text-[11px] font-semibold text-mute uppercase tracking-wide px-2 py-1">{TYPE_LABEL[g.type]}</div>
                  {g.items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => pick(a.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm text-left cursor-pointer ${
                        a.id === activeAccountId ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
                      }`}
                    >
                      <span className="truncate">
                        {a.name}
                        {a.type === 'propfirm' && a.phase && <span className="text-mute"> · {a.phase}</span>}
                      </span>
                      <span className="text-xs text-mute shrink-0">{fmtMoney(accountValue(a.id), 0, a.currency)}</span>
                    </button>
                  ))}
                </div>
              ))}
              <div className="border-t border-line mt-1 pt-1 flex gap-1">
                <button
                  onClick={() => { setOpen(false); setCreateModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-mute hover:text-accent hover:bg-surface cursor-pointer"
                >
                  <Plus size={13} /> New account
                </button>
                <Link
                  to="/trading/accounts"
                  onClick={() => setOpen(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-mute hover:text-accent hover:bg-surface cursor-pointer"
                >
                  <Settings2 size={13} /> Manage
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      <AccountFormModal open={createModal} onClose={() => setCreateModal(false)} />
    </>
  );
}
