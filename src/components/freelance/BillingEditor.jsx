import { useMemo, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useFreelanceStore } from '../../store/freelanceStore';
import { useAccountingStore } from '../../store/accountingStore';
import { billingOf, BILLING_MODES, RATE_UNITS, RETAINER_FREQUENCIES, blockAllocation, effectiveHourlyRate } from '../../utils/billing';
import { fmtMoneyCur } from '../../utils/invoice';
import { uid, todayKey } from '../../utils/formatters';
import { Button, Field, Input, Select, IconButton } from '../common/ui';
import { toast } from '../../store/uiStore';

const num = (v) => (v === '' || v == null ? '' : v);

// The client's billing profile: rates (hour, day, half-day, unit), subscription
// (any frequency), fixed price with schedule, prepaid hours, commission,
// default discount / withholding and the revenue account used in Finances.
export default function BillingEditor({ engagement }) {
  const { editEngagement, sellBlock } = useFreelanceStore();
  // getAccountMap() builds a new object each call: read it once, never as a selector.
  const incomeAccounts = useMemo(() => Object.values(useAccountingStore.getState().getAccountMap()).filter((a) => a.cls === 7), []);
  const [b, setB] = useState(() => {
    const x = billingOf(engagement);
    return { ...x, incomeAccount: x.incomeAccount || '721' };
  });
  const [blockSale, setBlockSale] = useState({ hours: b.block?.hours || 10, price: b.block?.price || '' });
  const cur = engagement.currency;
  const on = (k) => k === 'rates' || !!b[k]?.enabled;
  const toggle = (k) => setB((x) => ({ ...x, [k]: { ...(x[k] || {}), enabled: !x[k]?.enabled } }));
  const setIn = (k, field, v) => setB((x) => ({ ...x, [k]: { ...(x[k] || {}), [field]: v } }));
  const setRate = (i, field, v) => setB((x) => ({ ...x, rates: x.rates.map((r, j) => (j === i ? { ...r, [field]: v } : r)) }));
  const milestones = b.fixed?.milestones || [];
  const msTotal = milestones.reduce((a, m) => a + (Number(m.pct) || 0), 0);
  const block = b.block?.enabled ? blockAllocation(engagement.timeLogs || [], engagement.blockPurchases, b) : null;
  const eff = effectiveHourlyRate({ ...engagement, billing: b });

  const save = () => {
    const clean = {
      ...b,
      rates: b.rates.filter((r) => String(r.label).trim()).map((r) => ({ ...r, price: Number(r.price) || 0, vatRate: r.vatRate === '' || r.vatRate == null ? null : Number(r.vatRate) })),
      roundingMin: Number(b.roundingMin) || 0, minimumHours: Number(b.minimumHours) || 0, dayHours: Number(b.dayHours) || 8,
      discountPct: Number(b.discountPct) || 0, withholdingPct: Number(b.withholdingPct) || 0,
    };
    if (!clean.rates.length) { toast('Garde au moins un tarif.', 'warning'); return; }
    editEngagement(engagement.id, { billing: clean });
    toast('Facturation enregistrée.', 'success');
  };

  const section = (k, children) => {
    const m = BILLING_MODES.find((x) => x.key === k);
    return (
      <div className="rounded-lg border border-line p-3 space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          {k !== 'rates' && <input type="checkbox" className="mt-1 accent-[var(--accent-primary)]" checked={on(k)} onChange={() => toggle(k)} />}
          <span><span className="text-sm font-semibold">{m.label}</span><span className="block text-xs text-mute">{m.hint}</span></span>
        </label>
        {(k === 'rates' || on(k)) && children}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {section('rates', (
        <div className="space-y-2">
          {b.rates.map((r, i) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><Field label={i ? '' : 'Prestation'}><Input value={r.label} onChange={(e) => setRate(i, 'label', e.target.value)} placeholder="ex. Conseil, Formation, Article" /></Field></div>
              <div className="col-span-3"><Field label={i ? '' : `Prix (${cur})`}><Input type="number" min="0" step="any" value={num(r.price)} onChange={(e) => setRate(i, 'price', e.target.value)} /></Field></div>
              <div className="col-span-2"><Field label={i ? '' : 'Par'}><Select value={r.unit} onChange={(e) => setRate(i, 'unit', e.target.value)} options={RATE_UNITS.map((u) => ({ value: u.key, label: u.label }))} /></Field></div>
              {r.unit === 'unit'
                ? <div className="col-span-1"><Field label={i ? '' : 'Nom'}><Input value={r.unitLabel || ''} onChange={(e) => setRate(i, 'unitLabel', e.target.value)} placeholder="page" /></Field></div>
                : <div className="col-span-1" />}
              <IconButton className="col-span-1" label="Retirer ce tarif" tone="danger" disabled={b.rates.length < 2} onClick={() => setB((x) => ({ ...x, rates: x.rates.filter((_, j) => j !== i) }))}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          <button type="button" className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setB((x) => ({ ...x, rates: [...x.rates, { id: uid(), label: '', price: '', unit: 'h', unitLabel: '', vatRate: null }] }))}><Plus size={12} /> Ajouter un tarif</button>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Arrondir les heures à"><Select value={String(b.roundingMin || 0)} onChange={(e) => setB((x) => ({ ...x, roundingMin: Number(e.target.value) }))} options={[['0', 'Pas d’arrondi'], ['6', '6 min'], ['15', '15 min'], ['30', '30 min'], ['60', '1 h']].map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Minimum facturé (h)"><Input type="number" min="0" step="0.25" value={num(b.minimumHours)} onChange={(e) => setB((x) => ({ ...x, minimumHours: e.target.value }))} /></Field>
            <Field label="Heures par jour"><Input type="number" min="1" step="0.5" value={num(b.dayHours)} onChange={(e) => setB((x) => ({ ...x, dayHours: e.target.value }))} /></Field>
          </div>
        </div>
      ))}

      {section('retainer', (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Field label={`Montant (${cur})`}><Input type="number" min="0" step="any" value={num(b.retainer?.amount)} onChange={(e) => setIn('retainer', 'amount', e.target.value)} /></Field>
          <Field label="Fréquence"><Select value={String(b.retainer?.every || 1)} onChange={(e) => setIn('retainer', 'every', Number(e.target.value))} options={RETAINER_FREQUENCIES.map((x) => ({ value: String(x.every), label: x.label }))} /></Field>
          <Field label="Facturé"><Select value={b.retainer?.timing || 'start'} onChange={(e) => setIn('retainer', 'timing', e.target.value)} options={[{ value: 'start', label: 'En début de période' }, { value: 'end', label: 'En fin de période' }]} /></Field>
          <Field label="Heures incluses (facultatif)"><Input type="number" min="0" step="0.5" value={num(b.retainer?.includedHours)} onChange={(e) => setIn('retainer', 'includedHours', e.target.value)} /></Field>
          <Field label={`Heure en plus (${cur})`}><Input type="number" min="0" step="any" value={num(b.retainer?.overagePrice)} onChange={(e) => setIn('retainer', 'overagePrice', e.target.value)} /></Field>
        </div>
      ))}

      {section('fixed', (
        <div className="space-y-2">
          <Field label={`Prix du forfait (${cur})`}><Input type="number" min="0" step="any" value={num(b.fixed?.amount)} onChange={(e) => setIn('fixed', 'amount', e.target.value)} /></Field>
          <div className="text-xs text-mute">Échéancier</div>
          {milestones.map((m, i) => (
            <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-5" value={m.label} disabled={!!m.invoiceId} onChange={(e) => setIn('fixed', 'milestones', milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="ex. Acompte" />
              <div className="col-span-2 flex items-center gap-1"><Input type="number" min="0" max="100" value={num(m.pct)} disabled={!!m.invoiceId} onChange={(e) => setIn('fixed', 'milestones', milestones.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))} /><span className="text-xs">%</span></div>
              <Input className="col-span-3" type="date" value={m.due || ''} disabled={!!m.invoiceId} onChange={(e) => setIn('fixed', 'milestones', milestones.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
              <span className="col-span-1 text-[11px] text-good">{m.invoiceId ? 'facturé' : ''}</span>
              {!m.invoiceId && <IconButton className="col-span-1" label="Retirer" tone="danger" onClick={() => setIn('fixed', 'milestones', milestones.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton>}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="button" className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1" onClick={() => setIn('fixed', 'milestones', [...milestones, { id: uid(), label: '', pct: '', due: '' }])}><Plus size={12} /> Ajouter une étape</button>
            {milestones.length > 0 && <span className={`text-xs ${Math.round(msTotal) === 100 ? 'text-good' : 'text-warn'}`}>Total {msTotal} % {Math.round(msTotal) === 100 ? '' : '(devrait faire 100 %)'}</span>}
          </div>
          {eff != null && <p className="text-xs text-mute">Au temps passé, ce forfait te rapporte <b className="text-ink">{fmtMoneyCur(eff, cur)}</b> de l’heure.</p>}
        </div>
      ))}

      {section('block', (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Heures du paquet"><Input type="number" min="1" step="0.5" value={num(blockSale.hours)} onChange={(e) => setBlockSale((x) => ({ ...x, hours: e.target.value }))} /></Field>
            <Field label={`Prix du paquet (${cur})`}><Input type="number" min="0" step="any" value={num(blockSale.price)} onChange={(e) => setBlockSale((x) => ({ ...x, price: e.target.value }))} /></Field>
          </div>
          {block && <p className="text-xs text-mute">Heures restantes : <b className="text-ink font-data">{block.remaining} h</b> sur {(engagement.blockPurchases || []).reduce((a, p) => a + Number(p.hours || 0), 0)} h achetées.</p>}
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" disabled={!(Number(blockSale.hours) > 0) || !(Number(blockSale.price) > 0)}
            onClick={() => { setIn('block', 'hours', Number(blockSale.hours)); setIn('block', 'price', Number(blockSale.price)); const r = sellBlock(engagement.id, { hours: Number(blockSale.hours), price: Number(blockSale.price), date: todayKey() }); if (!r.ok) toast(r.error, 'error'); }}>
            Facturer un paquet de {blockSale.hours || 0} h
          </Button>
        </div>
      ))}

      {section('commission', (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Taux (%)"><Input type="number" min="0" max="100" step="any" value={num(b.commission?.pct)} onChange={(e) => setIn('commission', 'pct', e.target.value)} /></Field>
          <Field label="Calculée sur"><Select value={b.commission?.on || 'amount'} onChange={(e) => setIn('commission', 'on', e.target.value)} options={[{ value: 'amount', label: 'Un montant (vente, contrat…)' }, { value: 'profit', label: 'Le bénéfice net (ventes − coûts)' }]} /></Field>
        </div>
      ))}

      <div className="rounded-lg border border-line p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="Remise habituelle (%)"><Input type="number" min="0" max="100" step="any" value={num(b.discountPct)} onChange={(e) => setB((x) => ({ ...x, discountPct: e.target.value }))} /></Field>
        <Field label="Retenue à la source (%)" hint="Si ce client retient un impôt sur tes factures."><Input type="number" min="0" max="100" step="any" value={num(b.withholdingPct)} onChange={(e) => setB((x) => ({ ...x, withholdingPct: e.target.value }))} /></Field>
        <Field label="Compte de revenus (Finances)" hint="Où arrivent les paiements hors TVA.">
          <Select value={b.incomeAccount} onChange={(e) => setB((x) => ({ ...x, incomeAccount: e.target.value }))} options={incomeAccounts.map((a) => ({ value: a.code, label: `${a.code} · ${a.label}` }))} />
        </Field>
      </div>
      <div className="flex justify-end"><Button onClick={save}><span className="flex items-center gap-1.5"><Save size={14} /> Enregistrer la facturation</span></Button></div>
    </div>
  );
}
