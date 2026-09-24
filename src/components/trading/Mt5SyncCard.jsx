import { useEffect, useState } from 'react';
import { RefreshCw, Download, KeyRound, Copy, Radio, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { STRATEGIES } from '../../utils/constants';
import { fmtMoney } from '../../utils/formatters';
import { Card, Button, Select } from '../common/ui';
import { toast } from '../../store/uiStore';
import { getSyncKeyStatus, createSyncKey, revokeSyncKey, mt5SyncAvailable } from '../../services/mt5-sync';
import { syncMt5Now, useMt5SyncStatus } from '../../hooks/useMt5Sync';

const SITE = 'https://vaudax.vercel.app';
const ago = (ms) => {
  if (!ms) return 'never';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

export default function Mt5SyncCard() {
  const { accounts, mt5Links, setMt5Link, addAccount, editAccount, customStrategies, mt5Strategy, setMt5Strategy } = useTradingStore();
  const { inbox, checkedAt, busy } = useMt5SyncStatus();
  const [keyStatus, setKeyStatus] = useState(undefined); // undefined = loading / not signed in
  const [newKey, setNewKey] = useState('');
  const [working, setWorking] = useState(false);
  const available = mt5SyncAvailable();

  useEffect(() => { if (available) { getSyncKeyStatus().then(setKeyStatus); syncMt5Now().catch(() => {}); } }, [available]);

  if (!available) {
    return <Card title="MT5 live sync"><p className="text-sm text-mute">Live sync needs cloud sync (sign in with your AUDAX cloud account). Meanwhile, use “Import MT5” with the History report.</p></Card>;
  }

  const generate = async () => {
    if (keyStatus && !confirm('Generate a new key? The EA using the current key will stop syncing until you paste the new one.')) return;
    setWorking(true);
    try { setNewKey(await createSyncKey()); setKeyStatus(await getSyncKeyStatus()); } catch (e) { toast(e.message, 'error'); } finally { setWorking(false); }
  };
  const revoke = async () => {
    if (!confirm('Revoke the MT5 sync key? Every EA using it stops syncing.')) return;
    try { await revokeSyncKey(); setKeyStatus(null); setNewKey(''); toast('MT5 sync key revoked', 'info'); } catch (e) { toast(e.message, 'error'); }
  };
  const syncNow = async () => {
    const n = await syncMt5Now();
    if (!n) toast('Up to date — no new closed positions', 'info');
  };
  const link = async (login, value) => {
    const meta = inbox?.accounts?.[login] || {};
    if (value === 'new') {
      const type = /fund|prop|ftmo|challenge|phase|eval/i.test(`${meta.company} ${meta.name} ${meta.server}`) ? 'propfirm' : meta.demo ? 'demo' : 'broker';
      const id = addAccount({ type, name: meta.name || `MT5 ${login}`, currency: meta.currency || 'USD', broker: meta.company || '', accountNumber: login, initialBalance: meta.firstDeposit || meta.balance || 0 });
      if (meta.firstDepositTime) editAccount(id, { currentPhaseStartAt: meta.firstDepositTime * 1000 });
      setMt5Link(login, id);
    } else setMt5Link(login, value || null);
    await syncMt5Now();
  };

  const terminals = Object.entries(inbox?.accounts || {}).sort((a, b) => (b[1].lastSync || 0) - (a[1].lastSync || 0));
  const strategies = [...STRATEGIES, ...customStrategies.map((c) => c.name)];

  return (
    <Card title="MT5 live sync" action={<button onClick={syncNow} disabled={busy} className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Sync now</button>}>
      <p className="text-sm text-mute mb-3">A small read-only Expert Advisor sends every closed position from MetaTrader 5 to AUDAX automatically — no more exports. It never opens, modifies or closes a trade, and its key can only <i>send</i> trades: it cannot read your AUDAX data.</p>

      {newKey && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 mb-3 space-y-2">
          <div className="text-xs font-semibold">Your MT5 sync key — copy it now, it won’t be shown again</div>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 truncate text-xs bg-surface border border-line rounded px-2 py-1.5">{newKey}</code>
            <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => { navigator.clipboard?.writeText(newKey); toast('Key copied', 'success'); }}><Copy size={13} /></Button>
          </div>
        </div>
      )}

      <ol className="space-y-2.5 text-sm">
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span>Sync key</span>
              {keyStatus ? <span className="text-xs text-good flex items-center gap-1"><CheckCircle2 size={12} /> active since {new Date(keyStatus.createdAt).toLocaleDateString()}</span> : keyStatus === null ? <span className="text-xs text-mute">none yet</span> : <span className="text-xs text-mute">sign in to the cloud to create one</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Button className="!py-1 !px-2.5 text-xs" onClick={generate} disabled={working || keyStatus === undefined}><span className="flex items-center gap-1.5"><KeyRound size={13} /> {keyStatus ? 'New key' : 'Generate key'}</span></Button>
              {keyStatus && <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={revoke}>Revoke</Button>}
            </div>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
          <div className="flex-1">
            <a href="/downloads/AUDAX_Sync.mq5" download className="inline-flex items-center gap-1.5 text-accent hover:underline"><Download size={13} /> Download AUDAX_Sync.mq5</a>
            <div className="text-xs text-mute mt-0.5">MT5 › File › Open Data Folder › MQL5 › Experts: paste it there, then open it in MetaEditor and press <b>Compile</b> (F7).</div>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
          <div className="flex-1 text-xs text-mute">MT5 › Tools › Options › Expert Advisors › tick <b className="text-ink">Allow WebRequest for listed URL</b> and add <code className="text-ink">{SITE}</code></div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
          <div className="flex-1 text-xs text-mute">Drag <b className="text-ink">AUDAX_Sync</b> onto any chart of the account, paste the key in its inputs, keep the chart open. The chart shows “AUDAX Sync OK” once connected. One EA per MT5 account (each terminal / login).</div>
        </li>
      </ol>

      <div className="text-[11px] text-mute mt-3 flex items-start gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5 text-warn" /> Prop firms: this EA only reads your history, but check your firm’s rules on EAs. To be extra safe you can run it in a second MT5 terminal logged in with your read-only <b>investor password</b>.</div>

      <div className="mt-4 pt-3 border-t border-line">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Radio size={14} className="text-accent" />
          <span className="text-sm font-semibold flex-1">Connected MT5 accounts</span>
          <span className="text-[11px] text-mute">checked {ago(checkedAt)}</span>
        </div>
        {terminals.length ? (
          <div className="space-y-2">
            {terminals.map(([login, meta]) => {
              const stale = meta.lastSync && Date.now() - meta.lastSync > 30 * 60000;
              return (
                <div key={login} className="rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <span className={`w-2 h-2 rounded-full ${stale ? 'bg-warn' : 'bg-good'}`} title={stale ? 'No sync for 30+ min — is the terminal open?' : 'Syncing'} />
                  <span className="font-medium">#{login}</span>
                  <span className="text-xs text-mute">{meta.name}{meta.company ? ` · ${meta.company}` : ''}{meta.demo ? ' · demo' : ''}</span>
                  {meta.balance != null && <span className="text-xs text-mute">balance {fmtMoney(meta.balance, 0, meta.currency)}{meta.equity != null ? ` · equity ${fmtMoney(meta.equity, 0, meta.currency)}` : ''}</span>}
                  <span className="text-xs text-mute">{(inbox.positions?.[login] || []).length} positions · last sync {ago(meta.lastSync)}</span>
                  <span className="ml-auto w-56">
                    <Select value={mt5Links?.[login] || ''} onChange={(e) => link(login, e.target.value)}
                      options={[{ value: '', label: 'Not linked — choose…' }, ...accounts.filter((a) => a.status !== 'archived').map((a) => ({ value: a.id, label: `→ ${a.name}` })), { value: 'new', label: '+ Create account from MT5' }]} />
                  </span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-mute">No MT5 terminal has synced yet. After step 4, positions appear here within a minute.</p>}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-mute">
          <span>Setup given to synced trades:</span>
          <span className="w-40"><Select value={mt5Strategy || STRATEGIES[0]} onChange={(e) => setMt5Strategy(e.target.value)} options={strategies} /></span>
          <span>(change it per trade in the Journal)</span>
        </div>
      </div>
    </Card>
  );
}
