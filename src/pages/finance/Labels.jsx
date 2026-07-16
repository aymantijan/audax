import { useState } from 'react';
import { Trash2, Tag } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { ACCOUNT_MAP } from '../../utils/chart-of-accounts';
import { fmtMAD } from '../../utils/formatters';
import { Card, Button, Field, Input, Badge, EmptyState } from '../../components/common/ui';
import AccountSelect from '../../components/common/AccountSelect';

const blankLimit = { account: '622', label: '', maxRatioToIncomePct: '', maxRatioToAccountSpendPct: '' };

export default function Labels() {
  const { setLabelLimit, deleteLabelLimit, getLabelsForAccount, getLabelLimitsStatus } = useAccountingStore();
  const [analysisAccount, setAnalysisAccount] = useState('622');
  const [form, setForm] = useState(blankLimit);

  const labels = getLabelsForAccount(analysisAccount);
  const accountTotal = labels.reduce((a, l) => a + l.total, 0);
  const limits = getLabelLimitsStatus();

  const submit = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    setLabelLimit(form.account, form.label.trim(), {
      maxRatioToIncomePct: form.maxRatioToIncomePct,
      maxRatioToAccountSpendPct: form.maxRatioToAccountSpendPct,
    });
    setForm({ ...blankLimit, account: form.account });
  };

  return (
    <div className="space-y-6">
      <Card title="Analyse par libellé">
        <div className="mb-4 max-w-sm">
          <Field label="Compte de dépense">
            <AccountSelect classes={[6]} value={analysisAccount} onChange={(e) => setAnalysisAccount(e.target.value)} />
          </Field>
        </div>
        {labels.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-mute text-xs text-left border-b border-line">
                  <th className="py-2">Libellé</th>
                  <th className="text-right">Écritures</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">% du poste</th>
                  <th className="text-right">Dernière fois</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((l) => (
                  <tr key={l.label} className="border-b border-line/40 last:border-0">
                    <td className="py-2">{l.label}</td>
                    <td className="text-right">{l.count}</td>
                    <td className="text-right font-medium">{fmtMAD(l.total)}</td>
                    <td className="text-right text-mute">{accountTotal > 0 ? `${Math.round((l.total / accountTotal) * 100)}%` : '—'}</td>
                    <td className="text-right text-mute">{l.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Aucune écriture avec libellé sur ce compte pour l'instant.</EmptyState>
        )}
      </Card>

      <Card title="Nouvelle limite de dépense par libellé">
        <p className="text-xs text-mute mb-3">
          Fixez un plafond pour un libellé précis (ex : "Omar's Café" sur Restaurants & cafés). Si le ratio est franchi,
          l'écriture sera bloquée au moment de la saisie — ajustez ou supprimez la limite ici pour la débloquer.
        </p>
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="Compte">
            <AccountSelect classes={[6]} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </Field>
          <Field label="Libellé">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex : Omar's Café" required />
          </Field>
          <Field label="Max % des revenus du mois" hint="Laisser vide pour ignorer ce garde-fou">
            <Input type="number" min="0" max="100" step="0.5" value={form.maxRatioToIncomePct} onChange={(e) => setForm({ ...form, maxRatioToIncomePct: e.target.value })} />
          </Field>
          <Field label="Max % du poste du mois" hint="Laisser vide pour ignorer ce garde-fou">
            <Input type="number" min="0" max="100" step="0.5" value={form.maxRatioToAccountSpendPct} onChange={(e) => setForm({ ...form, maxRatioToAccountSpendPct: e.target.value })} />
          </Field>
          <div className="col-span-2 md:col-span-4">
            <Button type="submit">Enregistrer la limite</Button>
          </div>
        </form>
      </Card>

      <Card title="Limites configurées">
        {limits.length ? (
          <ul className="space-y-2">
            {limits.map((l) => (
              <li key={l.id} className="bg-surface border border-line rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Tag size={13} className="text-accent" /> {l.label} <span className="text-mute text-xs">· {l.accountLabel}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {l.breached && <Badge color="var(--error)">Franchie</Badge>}
                    <button onClick={() => deleteLabelLimit(l.id)} className="text-mute hover:text-bad cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-mute">
                  {l.maxRatioToIncomePct != null && (
                    <span className={l.ratios.ratioToIncome > l.maxRatioToIncomePct ? 'text-bad' : ''}>
                      Revenus : {l.ratios.ratioToIncome ?? '—'}% / {l.maxRatioToIncomePct}%
                    </span>
                  )}
                  {l.maxRatioToAccountSpendPct != null && (
                    <span className={l.ratios.ratioToAccountSpend > l.maxRatioToAccountSpendPct ? 'text-bad' : ''}>
                      Poste : {l.ratios.ratioToAccountSpend ?? '—'}% / {l.maxRatioToAccountSpendPct}%
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Aucune limite configurée.</EmptyState>
        )}
      </Card>
    </div>
  );
}
