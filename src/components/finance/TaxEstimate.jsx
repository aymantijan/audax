import { useMemo, useState } from 'react';
import { Landmark, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAccountingStore } from '../../store/accountingStore';
import { classOf } from '../../utils/chart-of-accounts';
import { MA_IR_2025, MA_AUTO_ENTREPRENEUR, moroccoIncomeTax, moroccoAutoEntrepreneur, TAX_COUNTRIES } from '../../utils/tax-estimate';
import { fmtMAD, todayKey } from '../../utils/formatters';
import { Card, Field, Input, Select, Stat } from '../common/ui';

const pct = (r) => `${(Math.round(r * 1000) / 10).toLocaleString('fr-FR')} %`;

// Income recorded this year in Finances (revenue accounts, class 7).
function useYearIncome() {
  const journal = useAccountingStore((s) => s.journal);
  return useMemo(() => {
    const year = todayKey().slice(0, 4);
    let total = 0;
    for (const e of journal) {
      if (!e.date?.startsWith(year)) continue;
      for (const l of e.lines || []) if (classOf(l.account) === 7) total += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    }
    return Math.max(0, Math.round(total));
  }, [journal]);
}

// Indicative tax estimate — Morocco for now (2025 scale), clearly labelled.
export default function TaxEstimate() {
  const country = useAuthStore((s) => s.user?.country);
  const baseCurrency = useAccountingStore((s) => s.baseCurrency);
  const yearIncome = useYearIncome();
  const [mode, setMode] = useState('ir');
  const [income, setIncome] = useState('');
  const [activity, setActivity] = useState('services');
  const value = income === '' ? yearIncome : Number(String(income).replace(/\s/g, '').replace(',', '.')) || 0;

  if (!TAX_COUNTRIES.includes(country || 'MA') || (baseCurrency && baseCurrency !== 'MAD')) {
    return (
      <Card title="Impôts (estimation)">
        <p className="text-sm text-mute">L’estimation d’impôt est disponible pour le Maroc (comptes en dirhams) pour l’instant. D’autres pays suivront.</p>
      </Card>
    );
  }

  const ir = moroccoIncomeTax(value);
  const ae = moroccoAutoEntrepreneur(value, activity);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm">
        <Info size={16} className="text-warn shrink-0 mt-0.5" />
        <p>Estimation indicative, pas un conseil fiscal : barème de la loi de finances 2025. Ta situation réelle (déductions, cotisations, charges de famille) peut changer le montant. Vérifie auprès de la DGI ou d’un comptable.</p>
      </div>

      <Card title={<span className="flex items-center gap-2"><Landmark size={15} /> Impôts (estimation · Maroc)</span>}>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <Field label="Régime">
            <Select value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: 'ir', label: 'Impôt sur le revenu (barème)' }, { value: 'ae', label: 'Auto-entrepreneur' }]} />
          </Field>
          <Field label={mode === 'ir' ? 'Revenu net imposable annuel (DH)' : 'Chiffre d’affaires annuel (DH)'} hint={income === '' ? `Pré-rempli avec tes revenus enregistrés cette année : ${fmtMAD(yearIncome)}.` : 'Efface le champ pour reprendre tes revenus enregistrés.'}>
            <Input inputMode="decimal" value={income} placeholder={String(yearIncome)} onChange={(e) => setIncome(e.target.value)} />
          </Field>
          {mode === 'ae' && (
            <Field label="Activité">
              <Select value={activity} onChange={(e) => setActivity(e.target.value)} options={Object.entries(MA_AUTO_ENTREPRENEUR).map(([k, a]) => ({ value: k, label: a.label }))} />
            </Field>
          )}
        </div>

        {mode === 'ir' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Impôt estimé sur l’année" value={fmtMAD(ir.tax)} />
              <Stat label="Soit par mois" value={fmtMAD(ir.monthly)} />
              <Stat label="Taux moyen" value={pct(ir.effectiveRate)} />
              <Stat label="Tranche atteinte" value={pct(ir.marginalRate)} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-mute border-b border-line"><th className="py-2 pr-4">Revenu annuel</th><th className="py-2 pr-4 text-right">Taux</th><th className="py-2 text-right">Somme à déduire</th></tr></thead>
                <tbody>
                  {MA_IR_2025.map((b, i) => {
                    const from = i ? MA_IR_2025[i - 1].upTo + 1 : 0;
                    const active = value >= from && value <= b.upTo;
                    return (
                      <tr key={i} className={`border-b border-line/50 ${active ? 'text-accent font-semibold' : ''}`}>
                        <td className="py-2 pr-4">{b.upTo === Infinity ? `plus de ${fmtMAD(from - 1)}` : `${fmtMAD(from)} à ${fmtMAD(b.upTo)}`}</td>
                        <td className="py-2 pr-4 text-right">{pct(b.rate)}</td>
                        <td className="py-2 text-right">{fmtMAD(b.deduction)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label="Impôt estimé sur l’année" value={fmtMAD(ae.tax)} />
              <Stat label="Taux sur le chiffre d’affaires" value={pct(ae.rate)} />
              <Stat label="Plafond annuel" value={fmtMAD(ae.ceiling)} color={ae.overCeiling ? 'var(--error)' : undefined} />
            </div>
            {ae.overCeiling && <p className="text-sm text-bad">Au-delà du plafond, le statut d’auto-entrepreneur ne s’applique plus : renseigne-toi sur le régime qui te correspond.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
