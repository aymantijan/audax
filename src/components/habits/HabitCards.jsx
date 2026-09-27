import { useMemo, useState } from 'react';
import { Plus, Minus, Trophy, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { coachAdvice, habitCorrelations } from '../../utils/habit-coach';
import { toast } from '../../store/uiStore';
import { sourceMeta } from '../../utils/habit-sources';
import { useHabitStore } from '../../store/habitStore';
import { quitStreak, quitBest } from '../../utils/calculations';
import { Card, Button, ProgressBar } from '../common/ui';
import { tint, catLabel } from './habit-ui';

export function QuantityControl({ h, value, date }) {
  const setHabitValue = useHabitStore((st) => st.setHabitValue);
  const [draft, setDraft] = useState(null);
  const src = sourceMeta(h.source);
  const target = Number(h.target) || 0;
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = h.direction === 'atMost' && value > target;
  const color = h.direction === 'atMost' ? (over ? 'var(--error)' : 'var(--success)') : value >= target ? 'var(--success)' : 'var(--accent-primary)';
  const step = target >= 1000 ? 500 : target >= 100 ? 10 : 1;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex-1 max-w-[12rem]"><ProgressBar value={h.direction === 'atMost' ? (over ? 100 : pct) : pct} height={5} color={color} /></div>
      {src ? (
        <span className="text-[11px] tabular-nums" style={{ color }}>{value}/{target} {h.unit}</span>
      ) : (
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 rounded border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center" onClick={() => setHabitValue(h.id, date, Math.max(0, value - step))}><Minus size={11} /></button>
          {draft != null ? (
            <form onSubmit={(e) => { e.preventDefault(); setHabitValue(h.id, date, Number(String(draft).replace(',', '.')) || 0); setDraft(null); }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { setHabitValue(h.id, date, Number(String(draft).replace(',', '.')) || 0); setDraft(null); }}
                className="w-14 bg-surface border border-accent rounded px-1 py-0.5 text-[11px] text-center tabular-nums text-ink" />
            </form>
          ) : (
            <button onClick={() => setDraft(String(value))} className="text-[11px] tabular-nums px-1 cursor-pointer hover:underline" style={{ color }} title="Saisir la valeur">{value}/{target} {h.unit}</button>
          )}
          <button className="w-6 h-6 rounded border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center" onClick={() => setHabitValue(h.id, date, value + step)}><Plus size={11} /></button>
        </div>
      )}
      {h.direction === 'atMost' && <span className="text-[10px] text-mute">{over ? 'limite dépassée' : `max ${target}`}</span>}
    </div>
  );
}

export const QUIT_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];

export function QuitCard({ h, today, onRelapse }) {
  const undoRelapse = useHabitStore((st) => st.undoRelapse);
  const days = quitStreak(h, today);
  const best = quitBest(h, today);
  const next = QUIT_MILESTONES.find((m) => m > days) || null;
  const prev = [...QUIT_MILESTONES].reverse().find((m) => m <= days) || 0;
  const lastRelapse = (h.relapses || []).slice(-1)[0];
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{h.name}</div>
          <div className="text-[11px] text-mute">{catLabel(h.category)} · record {best} j</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color: days >= 7 ? 'var(--success)' : 'var(--accent-primary)' }}>{days}</div>
          <div className="text-[10px] text-mute">jour{days > 1 ? 's' : ''} sans</div>
        </div>
      </div>
      {next && (
        <div className="mt-3">
          <ProgressBar value={((days - prev) / (next - prev)) * 100} height={4} color="var(--success)" />
          <div className="text-[10px] text-mute mt-1 flex items-center gap-1"><Trophy size={10} /> prochain palier : {next} jour{next > 1 ? 's' : ''}</div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => onRelapse(h)}>J’ai craqué</Button>
        {lastRelapse === today && <button className="text-[11px] text-mute hover:text-ink underline cursor-pointer" onClick={() => undoRelapse(h.id, today)}>annuler</button>}
      </div>
    </div>
  );
}

export function orderChains(items) {
  const ids = new Set(items.map((h) => h.id));
  const out = []; const seen = new Set();
  const visit = (h, depth) => {
    if (seen.has(h.id)) return;
    seen.add(h.id); out.push({ h, depth });
    items.filter((c) => c.after === h.id).forEach((c) => visit(c, Math.min(depth + 1, 2)));
  };
  items.filter((h) => !h.after || !ids.has(h.after)).forEach((h) => visit(h, 0));
  items.forEach((h) => visit(h, 0)); // cycles: never drop a habit
  return out;
}

export async function enableReminders(setEnabled) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
  setEnabled(true);
  toast(typeof Notification !== 'undefined' && Notification.permission === 'granted'
    ? 'Rappels activés : notification à l’heure choisie (VAUDAX ouvert).'
    : 'Rappels activés dans l’app (notifications du navigateur refusées).', 'success');
}

// ── Coach: slipping habits, mini versions, habit ↔ check-in links ──
export const pctOf = (r) => `${Math.round((r || 0) * 100)} %`;
export const nf1 = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
export const METRIC_GENDER_F = { energy: true, sleep: true, stress: false }; // « votre énergie est plus élevée »

export function CoachCard({ habits, logs, energyLogs, today, onEdit }) {
  const { applyMini, restoreFull, snoozeCoach, editHabit } = useHabitStore();
  const coachSnooze = useHabitStore((s) => s.coachSnooze);
  const advice = useMemo(() => coachAdvice(habits, logs, today, coachSnooze || {}), [habits, logs, today, coachSnooze]);
  const links = useMemo(() => habitCorrelations(habits, logs, energyLogs, today), [habits, logs, energyLogs, today]);
  return (
    <Card>
      <div className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><Sparkles size={15} className="text-accent" /> Coach</div>
      {advice.length === 0 && links.length === 0 && (
        <p className="text-sm text-mute">Rien à signaler : tes habitudes tiennent.{energyLogs.length < 14 ? ' Les liens avec ton énergie, ton sommeil et ton stress apparaîtront après environ deux semaines de check-ins.' : ''}</p>
      )}
      {advice.length > 0 && (
        <div className="space-y-2">
          {advice.map((a) => {
            const h = a.habit;
            const slipping = a.type === 'slipping';
            const color = slipping ? 'var(--warning)' : 'var(--success)';
            const Icon = slipping ? TrendingDown : TrendingUp;
            return (
              <div key={h.id} className="rounded-xl border px-3 py-2.5 flex items-start gap-2" style={{ borderColor: tint(color, 40), background: tint(color, 6) }}>
                <Icon size={16} className="shrink-0 mt-0.5" style={{ color }} />
                <div className="min-w-0 flex-1 text-sm">
                  {slipping ? (
                    <>
                      <div className="text-ink">« {h.name} » décroche</div>
                      <div className="text-[12px] text-mute">
                        {a.weeks ? (Math.round(a.recent * 3) ? `Quota atteint 1 semaine sur les 3 dernières.` : `Quota non atteint ces 3 dernières semaines.`)
                          : `${a.done}/${a.due} jours réussis ces 14 derniers jours${a.prior != null ? ` (contre ${pctOf(a.prior)} avant)` : ''}.`}
                        {a.mini ? ` Réduis l’effort plutôt que d’abandonner : ${a.mini.text}.`
                          : a.fallback?.kind === 'reminder' ? ' Un rappel à heure fixe aide souvent à reprendre.'
                            : a.fallback?.kind === 'anchor' ? ` Accroche-la à « ${a.fallback.anchor.name} », qui tient bien.`
                              : ' Un joker ou une pause protège la série si la période est chargée.'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-ink">« {h.name} » tient bon en version mini</div>
                      <div className="text-[12px] text-mute">{a.done != null ? `${a.done}/${a.due} jours réussis ces 14 derniers jours (${pctOf(a.recent)}).` : 'Quota atteint 3 semaines sur 3.'} Prêt à revenir à la version normale ?</div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {slipping && a.mini && <Button className="!py-1 !px-2.5 text-xs" onClick={() => applyMini(h.id, a.mini.changes)}>Passer en version mini</Button>}
                    {slipping && !a.mini && a.fallback?.kind === 'reminder' && <Button className="!py-1 !px-2.5 text-xs" onClick={() => onEdit(h)}>Ajouter un rappel</Button>}
                    {slipping && !a.mini && a.fallback?.kind === 'anchor' && <Button className="!py-1 !px-2.5 text-xs" onClick={() => { editHabit(h.id, { after: a.fallback.anchor.id }); toast(`« ${h.name} » s’enchaîne désormais après « ${a.fallback.anchor.name} »`, 'success'); }}>L’enchaîner</Button>}
                    {!slipping && <Button className="!py-1 !px-2.5 text-xs" onClick={() => restoreFull(h.id)}>Revenir à la normale</Button>}
                    <Button variant="secondary" className="!py-1 !px-2.5 text-xs" onClick={() => snoozeCoach(h.id, slipping ? 7 : 14)}>{slipping ? 'Plus tard' : 'Rester en mini'}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {links.length > 0 && (
        <div className={advice.length ? 'mt-4 pt-3 border-t border-line' : ''}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mute mb-2">Ce que disent tes check-ins</div>
          <div className="space-y-1.5">
            {links.map((l) => {
              const fem = METRIC_GENDER_F[l.metric.key];
              const word = l.diff > 0 ? (fem ? 'plus élevée' : 'plus élevé') : (fem ? 'plus basse' : 'plus bas');
              const c = l.good ? 'var(--success)' : 'var(--error)';
              return (
                <div key={`${l.habit.id}-${l.metric.key}`} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-mute">
                    Le lendemain de « <span className="text-ink">{l.habit.name}</span> », ton {l.metric.label} est <b style={{ color: c }}>{word} de {nf1(Math.abs(l.diff))} pt</b>
                    <span className="text-[11px]"> ({nf1(l.withMean)} contre {nf1(l.withoutMean)} sur 10 · {l.nWith} j avec, {l.nWithout} j sans)</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-mute mt-2">Sur 120 jours. Ce sont des corrélations, pas une preuve de cause à effet.</p>
        </div>
      )}
    </Card>
  );
}
