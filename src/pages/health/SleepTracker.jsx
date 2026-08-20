import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, BedDouble } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useHabitStore } from '../../store/habitStore';
import { useHealthStore } from '../../store/healthStore';
import { SLEEP_BAND_COLOR } from '../../utils/sleep-quality';
import { Card, Button, EmptyState } from '../../components/common/ui';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

const TIER_COPY = {
  high: { label: 'Grosse journée d\'entraînement', color: 'var(--warning)', note: "Ta charge d'aujourd'hui (Gym + Cardio) est nettement au-dessus de ta moyenne récente — la littérature sur les athlètes situe le besoin réel de récupération plutôt entre 9 et 10h ces jours-là, contre 7-9h en général." },
  normal: { label: 'Journée d\'entraînement normale', color: 'var(--accent-primary)', note: "Charge dans ta moyenne habituelle — la plage générale adulte (7-9h, revue NSF de 133 méta-analyses) s'applique." },
  light: { label: 'Journée légère', color: 'var(--text-secondary)', note: "Charge en dessous de ta moyenne récente — vise plutôt le bas de la fourchette ci-dessus." },
  rest: { label: 'Jour de repos', color: 'var(--text-secondary)', note: "Rien loggé en Gym/Cardio aujourd'hui." },
};

// Sleep is entered once per day on the Habits page's morning check-in (bedtime +
// wake time → auto-scored) — reused here rather than duplicated, since burnout.js
// and the synergy score already depend on that single entry point.
export default function SleepTracker() {
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const { getSleepWindow, getSleepTarget } = useHealthStore();
  const navigate = useNavigate();
  const window_ = getSleepWindow();
  const target = getSleepTarget();
  const tierInfo = TIER_COPY[target.tier];

  const history = useMemo(
    () =>
      [...energyLogs]
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .slice(-7)
        .map((l) => ({
          date: l.date.slice(5),
          score: l.sleepData?.sleepQualityScore ?? 0,
          hours: l.sleepData?.sleepHours ?? 0,
          band: l.sleepData?.sleepQualityScore >= 9 ? 'excellent' : l.sleepData?.sleepQualityScore >= 7 ? 'good' : l.sleepData?.sleepQualityScore >= 5 ? 'poor' : 'critical',
        })),
    [energyLogs]
  );

  const avg = history.length ? Math.round((history.reduce((a, h) => a + h.score, 0) / history.length) * 10) / 10 : null;

  return (
    <div className="space-y-6">
      <Card title="Sommeil recommandé ce soir" action={<span className="text-xs font-medium" style={{ color: tierInfo.color }}>{tierInfo.label}</span>}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Moon size={20} className="text-accent shrink-0" />
            <div>
              <div className="text-xl font-bold">{target.targetMin}–{target.targetMax}h</div>
              <div className="text-xs text-mute">cette nuit</div>
            </div>
          </div>
          {target.bedtimeSuggestion && (
            <div className="flex items-center gap-2">
              <BedDouble size={20} className="text-accent shrink-0" />
              <div>
                <div className="text-xl font-bold">{target.bedtimeSuggestion}</div>
                <div className="text-xs text-mute">coucher suggéré (réveil habituel {window_?.wakeTime} inchangé)</div>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-mute mt-3">{tierInfo.note}</p>
        {target.floorApplied && (
          <p className="text-xs text-mute mt-1">
            Plancher relevé car <span className="font-medium">{target.floorReasons?.join(' + ')}</span> — même une journée "normale" justifie plus de sommeil que la moyenne générale, pas seulement les pics au-dessus de ta propre moyenne.
          </p>
        )}
        {target.avgLoad > 0 && (
          <p className="text-[11px] text-mute mt-1">Charge estimée aujourd'hui vs moyenne des 14 derniers jours : {target.todayLoad} vs {target.avgLoad}.</p>
        )}
      </Card>

      {window_ && (
        <Card title="Your Optimal Sleep Window">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-mute mb-1">Bedtime</div>
              <div className="text-xl font-bold">{window_.bedtime}</div>
            </div>
            <div>
              <div className="text-xs text-mute mb-1">Wake time</div>
              <div className="text-xl font-bold">{window_.wakeTime}</div>
            </div>
            <div className="text-xs text-mute">Based on {window_.sampleSize} of your best nights (avg {window_.avgQuality}/10)</div>
          </div>
        </Card>
      )}

      <Card title="7-Day Sleep Quality" action={<Button variant="secondary" onClick={() => navigate('/habits')}>Log tonight's sleep</Button>}>
        {history.length ? (
          <>
            <div className="text-sm text-mute mb-3">7-day average: <span className="text-ink font-semibold">{avg}/10</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {history.map((h, i) => (
                    <Cell key={i} fill={SLEEP_BAND_COLOR[h.band]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <EmptyState>No sleep data yet — log your bedtime and wake time on the Habits page.</EmptyState>
        )}
      </Card>
    </div>
  );
}
