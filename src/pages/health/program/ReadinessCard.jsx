import { useMemo } from 'react';
import { Gauge, CheckCircle2, MinusCircle, AlertOctagon, AlertTriangle } from 'lucide-react';
import { Card, Badge } from '../../../components/common/ui';
import { useHealthStore } from '../../../store/healthStore';
import { useHabitStore } from '../../../store/habitStore';

/**
 * ReadinessCard — daily auto-regulation, per the program's Section 14
 * (Monitoring & Nervous System Protection). Maps today's readiness score to
 * the three prescribed action tiers and surfaces the warning signs that call
 * for a mandatory pause.
 *
 * Reuses healthStore.getReadiness() + getOvertrainingAlerts() so it stays in
 * sync with the rest of Health rather than recomputing its own signals.
 */

// PDF tiers: ≥80 full session · 60-79 reduce volume 20% · <60 Zone 1 only
function tierFor(score) {
  if (score >= 80) return {
    key: 'full', label: 'Séance complète', color: 'var(--success)', Icon: CheckCircle2,
    action: 'Séance complète comme prévu — bonne journée pour pousser l\'intensité.',
  };
  if (score >= 60) return {
    key: 'reduce', label: 'Volume réduit', color: 'var(--warning)', Icon: MinusCircle,
    action: 'Réduire le volume de 20% (une série de moins par exercice). Garder la technique.',
  };
  return {
    key: 'light', label: 'Zone 1 seulement', color: 'var(--danger, #ef4444)', Icon: AlertOctagon,
    action: 'Cardio Zone 1 léger uniquement, pas de charge lourde. Envisager d\'avancer le jour de repos.',
  };
}

export default function ReadinessCard() {
  // Subscribe to the underlying data so the card recomputes on new logs.
  const workouts = useHealthStore((s) => s.workouts);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const getReadiness = useHealthStore((s) => s.getReadiness);
  const getOvertrainingAlerts = useHealthStore((s) => s.getOvertrainingAlerts);

  const readiness = useMemo(() => getReadiness(), [workouts, energyLogs]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = useMemo(() => getOvertrainingAlerts(), [workouts, energyLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = readiness?.score ?? null;
  const hasCheckIn = (energyLogs || []).some((l) => l.date === new Date().toISOString().slice(0, 10));
  const tier = score != null ? tierFor(score) : null;
  const dangerCount = alerts.filter((a) => a.level === 'danger').length;
  const mandatoryPause = dangerCount >= 2;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Gauge size={16} className="text-accent" />
        <span className="font-semibold text-sm">Readiness — auto-régulation</span>
        {!hasCheckIn && <Badge>Check-in du jour manquant</Badge>}
      </div>

      <div className="flex items-center gap-4">
        {/* Score */}
        <div className="text-center shrink-0">
          <div className="text-3xl font-bold" style={{ color: tier?.color || 'var(--text-mute)' }}>
            {score != null ? score : '—'}
          </div>
          <div className="text-[10px] text-mute">/ 100</div>
        </div>

        {/* Tier action */}
        {tier ? (
          <div className="flex-1 flex items-start gap-2 rounded-lg border px-3 py-2"
            style={{ borderColor: tier.color + '55', background: tier.color + '11' }}>
            <tier.Icon size={16} style={{ color: tier.color }} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold" style={{ color: tier.color }}>{tier.label}</div>
              <p className="text-xs text-mute mt-0.5">{tier.action}</p>
            </div>
          </div>
        ) : (
          <p className="flex-1 text-xs text-mute">
            Fais ton check-in énergie/sommeil du jour pour obtenir la recommandation d'auto-régulation.
          </p>
        )}
      </div>

      {/* Score breakdown */}
      {readiness?.breakdown && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-mute">
          <span>😴 Sommeil {readiness.breakdown.sleep}/30</span>
          <span>⚡ Énergie {readiness.breakdown.energy}/25</span>
          <span>🧘 Stress {readiness.breakdown.stress}/20</span>
          <span>💆 Récup {readiness.breakdown.recovery}/15</span>
          <span>🔥 Régularité {readiness.breakdown.consistency}/10</span>
        </div>
      )}

      {/* Warning signs */}
      {alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line space-y-1.5">
          {mandatoryPause && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-bad/10 border border-bad/30">
              <AlertOctagon size={15} className="text-bad mt-0.5 shrink-0" />
              <div className="text-xs text-bad font-semibold">
                {dangerCount} signaux d'alerte actifs → pause obligatoire de 3 à 5 jours (à prendre même en milieu de semaine).
              </div>
            </div>
          )}
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-xs">
              <AlertTriangle size={12} className={a.level === 'danger' ? 'text-bad mt-0.5' : 'text-warning mt-0.5'} />
              <span className="text-mute">{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
