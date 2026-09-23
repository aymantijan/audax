import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, FileUp, CalendarClock, AlertTriangle, PiggyBank, Gauge, Receipt, CheckCircle2, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Circle, Info,
} from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { useFinanceMode, describeEntry } from '../../components/finance/financeMode';
import { computeToday } from '../../components/finance/todayMoney';
import QuickEntryModal from '../../components/finance/QuickEntryModal';
import { fxNote } from '../../components/finance/CurrencyUI';
import BankImportModal from '../../components/finance/BankImportModal';
import { fmtMAD } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Card, Button, ProgressBar } from '../../components/common/ui';

const tint = (c, p = 14) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const frDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const relDay = (d, today) => {
  const n = Math.round((new Date(`${d}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  return n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : n < 0 ? `il y a ${-n} j` : `dans ${n} j`;
};

function Section({ icon: Icon, title, action, children }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-ink flex items-center gap-2"><Icon size={15} className="text-accent" /> {title}</div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default function FinanceToday() {
  const store = useAccountingStore();
  const simple = useFinanceMode() === 'simple';
  const { journal, echeances, goals, budgets, markEcheancePaid, getAccountMap } = store;
  const accountMap = getAccountMap();
  const [quickOpen, setQuickOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [explain, setExplain] = useState(false);

  const t = useMemo(() => computeToday(store), [journal, echeances, goals, budgets]); // eslint-disable-line react-hooks/exhaustive-deps
  const alloc = store.getGoalAllocation();
  const color = t.remaining < 0 ? 'var(--error)' : t.perDay < 30 ? 'var(--warning)' : 'var(--success)';
  const spentPct = t.income + t.upcomingIncome > 0 ? Math.min(100, (t.expense / (t.income + t.upcomingIncome)) * 100) : null;
  const monthPct = Math.round((t.dayOfMonth / t.daysInMonth) * 100);

  const pay = (row) => {
    const res = markEcheancePaid(row.id, row.occurrenceDate, t.today);
    if (!res.ok) toast(res.error, 'error'); else toast(`« ${row.label} » enregistrée`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Hero — what I can still spend */}
      <div className="rounded-2xl border border-line p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${tint(color, 12)}, var(--bg-tertiary) 60%)` }}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="text-xs text-mute flex items-center gap-1.5">
              Reste à dépenser jusqu'au {new Date(`${t.monthEnd}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              <button onClick={() => setExplain((v) => !v)} className="text-mute hover:text-ink cursor-pointer" title="Comment c'est calculé ?"><Info size={12} /></button>
            </div>
            <div className="text-4xl font-bold tabular-nums mt-1" style={{ color }}>{fmtMAD(t.remaining)}</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
              <span className="text-mute">soit <b className="text-ink tabular-nums">{fmtMAD(Math.max(0, t.perDay))}</b> / jour</span>
              <span className="text-mute"><b className="text-ink tabular-nums">{fmtMAD(Math.max(0, t.weekBudget))}</b> d'ici dimanche</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setQuickOpen(true)}><span className="flex items-center gap-1.5"><Zap size={15} /> Saisie éclair</span></Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}><span className="flex items-center gap-1.5"><FileUp size={15} /> Relevé bancaire</span></Button>
          </div>
        </div>

        {t.remaining < 0 && alloc.unallocated > 0 && (() => {
          // Spending more than this month's income is fine when it's planned
          // savings being used (e.g. a student living on savings) — show how
          // long the free money lasts at this pace instead of just a red number.
          const deficit = -t.remaining;
          const runway = alloc.unallocated / deficit;
          return (
            <div className="mt-4 rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2" style={{ borderColor: tint('var(--warning)', 40), background: tint('var(--warning)', 8) }}>
              <Info size={13} className="text-warning shrink-0 mt-0.5" />
              <span className="text-mute">
                Ce mois-ci, vos dépenses prévues dépassent vos revenus de <b className="text-ink">{fmtMAD(deficit)}</b> : l'écart est pris sur votre épargne libre ({fmtMAD(alloc.unallocated)}).
                {' '}À ce rythme, elle couvre environ <b className="text-ink">{runway >= 24 ? 'plus de 2 ans' : `${runway.toFixed(1).replace('.', ',')} mois`}</b>.
              </span>
            </div>
          );
        })()}

        {explain && (
          <div className="mt-4 rounded-xl bg-card/70 border border-line p-3 text-xs text-mute grid sm:grid-cols-2 gap-x-6 gap-y-1 tabular-nums">
            <span>Revenus reçus ce mois</span><span className="text-good sm:text-right">+{fmtMAD(t.income)}</span>
            <span>Revenus encore attendus (échéances)</span><span className="text-good sm:text-right">+{fmtMAD(t.upcomingIncome)}</span>
            <span>Dépenses déjà faites</span><span className="text-bad sm:text-right">−{fmtMAD(t.expense)}</span>
            <span>Dépenses encore prévues (échéances)</span><span className="text-bad sm:text-right">−{fmtMAD(t.upcomingExpense)}</span>
            <span>Épargne prévue pour vos objectifs</span><span className="sm:text-right">−{fmtMAD(t.savingsLeft)}</span>
            <span className="font-semibold text-ink">Reste à dépenser</span><span className="font-semibold sm:text-right" style={{ color }}>{fmtMAD(t.remaining)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Dépensé aujourd'hui</div>
            <div className="text-xl font-bold tabular-nums text-ink">{fmtMAD(t.spentToday)}</div>
            <div className="text-[11px] text-mute">{t.perDay > 0 ? (t.spentToday > t.perDay ? 'au-dessus du rythme' : 'dans le rythme') : ''}</div>
          </div>
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Cette semaine</div>
            <div className="text-xl font-bold tabular-nums text-ink">{fmtMAD(t.spentWeek)}</div>
            <div className="text-[11px] text-mute">dépensés depuis lundi</div>
          </div>
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Ce mois</div>
            <div className="text-xl font-bold tabular-nums text-ink">{fmtMAD(t.expense)}</div>
            {spentPct != null ? (
              <div className="mt-1"><ProgressBar value={spentPct} height={4} color={spentPct > monthPct + 10 ? 'var(--warning)' : 'var(--accent-primary)'} />
                <div className="text-[10px] text-mute mt-0.5">{Math.round(spentPct)}% des revenus · {monthPct}% du mois écoulé</div></div>
            ) : <div className="text-[11px] text-mute">aucun revenu ce mois</div>}
          </div>
          <div className="rounded-xl bg-card/70 border border-line px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">Libre sur vos comptes</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: alloc.unallocated < 0 ? 'var(--error)' : 'var(--text-primary)' }}>{fmtMAD(alloc.unallocated)}</div>
            <div className="text-[11px] text-mute">hors argent mis de côté</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Échéances */}
        <Section icon={CalendarClock} title="Échéances des 7 prochains jours" action={<Link to="/finance?tab=echeances" className="text-xs text-accent hover:underline">Toutes</Link>}>
          {t.overdue.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {t.overdue.slice(0, 4).map((r) => (
                <div key={`${r.id}-${r.occurrenceDate}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: tint('var(--error)', 10) }}>
                  <AlertTriangle size={13} className="text-bad shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-ink">{r.label}</span>
                  <span className="text-[11px] text-bad">{relDay(r.occurrenceDate, t.today)}</span>
                  <span className="tabular-nums text-sm">{fmtMAD(r.amount)}</span>
                  <Button className="!px-2 !py-0.5 text-[11px]" onClick={() => pay(r)}>Payée</Button>
                </div>
              ))}
            </div>
          )}
          {t.next7.length ? (
            <div className="divide-y divide-line/60">
              {t.next7.map((r) => (
                <div key={`${r.id}-${r.occurrenceDate}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-[11px] text-mute">{frDay(r.occurrenceDate)}</span>
                  <span className="flex-1 min-w-0 truncate text-ink">{r.label}</span>
                  {r.autoPost && <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-accent/15 text-accent">auto</span>}
                  <span className="tabular-nums font-medium" style={{ color: r.impact.income ? 'var(--success)' : r.impact.expense ? 'var(--error)' : undefined }}>
                    {r.impact.income ? '+' : r.impact.expense ? '−' : ''}{fmtMAD(r.amount)}
                  </span>
                  {!r.autoPost && r.occurrenceDate === t.today && <Button variant="secondary" className="!px-2 !py-0.5 text-[11px]" onClick={() => pay(r)}>Payée</Button>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute">Rien de prévu cette semaine. Ajoutez loyer, abonnements, bourse… dans <Link to="/finance?tab=echeances" className="text-accent underline">Échéances</Link>.</p>
          )}
        </Section>

        {/* Budgets */}
        <Section icon={Gauge} title="Budgets à surveiller" action={<Link to="/finance?tab=budget" className="text-xs text-accent hover:underline">Budget</Link>}>
          {t.budgets.length ? (
            <div className="space-y-3">
              {t.budgets.slice(0, 5).map((b) => {
                const pct = Math.min(100, b.realisation ?? 0);
                const bad = b.reel > b.amount;
                const risk = !bad && b.projected > b.amount;
                const c = bad ? 'var(--error)' : risk ? 'var(--warning)' : 'var(--success)';
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-ink truncate">{b.label} <span className="text-[11px] text-mute">· {b.periodLabel}</span></span>
                      <span className="tabular-nums text-xs text-mute"><b style={{ color: c }}>{fmtMAD(b.reel)}</b> / {fmtMAD(b.amount)}</span>
                    </div>
                    <div className="relative">
                      <ProgressBar value={pct} height={6} color={c} />
                      <div className="absolute top-[-2px] h-[10px] w-0.5 bg-ink/40" style={{ left: `${b.elapsedPct}%` }} title="Temps écoulé" />
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: bad || risk ? c : 'var(--text-secondary)' }}>
                      {bad ? `Dépassé de ${fmtMAD(-b.left)}` : risk ? `Au rythme actuel : ${fmtMAD(b.projected)} en fin de période` : `Reste ${fmtMAD(b.left)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-mute">Aucun budget. Fixez des plafonds (restaurants, shopping…) dans <Link to="/finance?tab=budget" className="text-accent underline">Budget</Link> pour les voir ici.</p>
          )}
        </Section>

        {/* Today's operations */}
        <Section icon={Receipt} title="Opérations du jour" action={<Link to="/finance?tab=journal" className="text-xs text-accent hover:underline">{simple ? 'Opérations' : 'Journal'}</Link>}>
          {t.todayEntries.length ? (
            <div className="divide-y divide-line/60">
              {t.todayEntries.map((e) => {
                const d = describeEntry(e, accountMap);
                const m = { expense: [ArrowUpRight, 'var(--error)', '−'], income: [ArrowDownLeft, 'var(--success)', '+'], transfer: [ArrowLeftRight, 'var(--accent-primary)', ''], other: [Circle, 'var(--text-secondary)', ''] }[d.kind];
                const Icon = m[0];
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                    <Icon size={14} style={{ color: m[1] }} className="shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-ink">{e.label}<span className="text-[11px] text-mute">{fxNote(e)}{d.category && d.kind !== 'transfer' ? ` · ${d.category}` : ''}</span></span>
                    <span className="tabular-nums font-medium" style={{ color: d.kind === 'other' ? undefined : m[1] }}>{m[2]}{fmtMAD(d.amount)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-mute flex items-center justify-between gap-3">
              <span>Aucune opération aujourd'hui.</span>
              <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setQuickOpen(true)}><span className="flex items-center gap-1"><Zap size={12} /> Ajouter</span></Button>
            </div>
          )}
        </Section>

        {/* Savings this month */}
        <Section icon={PiggyBank} title="Épargne du mois" action={<Link to="/finance?tab=goals" className="text-xs text-accent hover:underline">Objectifs</Link>}>
          {t.savings.length ? (
            <div className="space-y-3">
              {t.savings.map((s) => (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-ink truncate">{s.name}</span>
                    <span className="text-xs text-mute tabular-nums">{fmtMAD(s.done)} / {fmtMAD(s.needed)}</span>
                  </div>
                  <ProgressBar value={Math.min(100, (s.done / s.needed) * 100)} height={5} color={s.left === 0 ? 'var(--success)' : 'var(--accent-primary)'} />
                  <div className="text-[11px] mt-0.5 text-mute">{s.left === 0 ? <span className="text-good flex items-center gap-1"><CheckCircle2 size={11} /> effort du mois fait</span> : `encore ${fmtMAD(s.left)} à mettre de côté ce mois-ci`}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute">Aucun objectif d'épargne avec échéance. Créez une enveloppe (voyage, fonds d'urgence…) dans <Link to="/finance?tab=goals" className="text-accent underline">Objectifs</Link> : l'effort mensuel sera réservé ici.</p>
          )}
        </Section>
      </div>

      <QuickEntryModal open={quickOpen} onClose={() => setQuickOpen(false)} />
      <BankImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
