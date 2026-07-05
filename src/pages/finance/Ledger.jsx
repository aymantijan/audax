import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { ACCOUNT_CLASSES, accountLabel } from '../../utils/chart-of-accounts';
import { fmtMAD } from '../../utils/formatters';
import { Card, Field, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

export default function Ledger() {
  const store = useAccountingStore();
  const [account, setAccount] = useState('511');
  const rows = store.getLedger(account);
  const tb = store.getTrialBalance();
  const finalBalance = rows.length ? rows[rows.length - 1].running : 0;

  return (
    <div className="space-y-6">
      <Card title="Grand livre — compte par compte">
        <div className="max-w-md mb-4">
          <Field label="Compte">
            <AccountSelect value={account} onChange={(e) => setAccount(e.target.value)} />
          </Field>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Libellé</th>
                  <th className="py-2 pr-4 text-right">Débit</th>
                  <th className="py-2 pr-4 text-right">Crédit</th>
                  <th className="py-2 text-right">Solde progressif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line/40">
                    <td className="py-2 pr-4 whitespace-nowrap text-mute">{r.date}</td>
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4 text-right">{r.debit ? fmtMAD(r.debit) : ''}</td>
                    <td className="py-2 pr-4 text-right text-mute">{r.credit ? fmtMAD(r.credit) : ''}</td>
                    <td className="py-2 text-right font-medium" style={{ color: r.running >= 0 ? undefined : 'var(--error)' }}>
                      {fmtMAD(Math.abs(r.running))} {r.running >= 0 ? 'D' : 'C'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line font-semibold">
                  <td colSpan={4} className="py-2 pr-4 text-right text-xs text-mute uppercase">Solde final — {accountLabel(account)}</td>
                  <td className="py-2 text-right">{fmtMAD(Math.abs(finalBalance))} {finalBalance >= 0 ? 'Débiteur' : 'Créditeur'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyState>Aucun mouvement sur ce compte.</EmptyState>
        )}
      </Card>

      <Card
        title="Balance générale"
        action={
          tb.rows.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: tb.balanced ? 'var(--success)' : 'var(--error)' }}>
              {tb.balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {tb.balanced ? 'Équilibrée : Σ Débits = Σ Crédits' : 'DÉSÉQUILIBRE DÉTECTÉ'}
            </span>
          )
        }
      >
        {tb.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-3">Compte</th>
                  <th className="py-2 pr-3 text-right">Total débits</th>
                  <th className="py-2 pr-3 text-right">Total crédits</th>
                  <th className="py-2 pr-3 text-right">Solde débiteur</th>
                  <th className="py-2 text-right">Solde créditeur</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.code} className="border-b border-line/40">
                    <td className="py-1.5 pr-3">
                      <span className="text-mute text-xs mr-2">{r.code}</span>
                      {r.label}
                      <span className="text-[10px] text-mute ml-2">cl.{r.cls} · {ACCOUNT_CLASSES[r.cls].label}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-right">{fmtMAD(r.debit)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmtMAD(r.credit)}</td>
                    <td className="py-1.5 pr-3 text-right">{r.soldeDebiteur ? fmtMAD(r.soldeDebiteur) : ''}</td>
                    <td className="py-1.5 text-right">{r.soldeCrediteur ? fmtMAD(r.soldeCrediteur) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-2 pr-3 text-xs uppercase text-mute">Totaux</td>
                  <td className="py-2 pr-3 text-right">{fmtMAD(tb.totals.debit)}</td>
                  <td className="py-2 pr-3 text-right">{fmtMAD(tb.totals.credit)}</td>
                  <td className="py-2 pr-3 text-right">{fmtMAD(tb.totals.soldeDebiteur)}</td>
                  <td className="py-2 text-right">{fmtMAD(tb.totals.soldeCrediteur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyState>La balance se remplit dès la première écriture au journal.</EmptyState>
        )}
      </Card>
    </div>
  );
}
