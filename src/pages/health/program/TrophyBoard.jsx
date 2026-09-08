import { Trophy } from 'lucide-react';
import { Card, EmptyState } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';

const TIER_STYLES = {
  bronze: { bg: 'bg-amber-900/10', border: 'border-amber-700/30', text: 'text-amber-600' },
  silver: { bg: 'bg-gray-300/10', border: 'border-gray-400/30', text: 'text-gray-400' },
  gold: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-500' },
  diamond: { bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', text: 'text-cyan-400' },
};

/**
 * Trophy board — achieved goals become immutable records with achievement context.
 */
export default function TrophyBoard() {
  const store = useProgramStore();
  const { trophies } = store;

  if (!trophies.length) {
    return (
      <Card>
        <EmptyState>
          <Trophy size={20} className="mx-auto mb-2" />
          Pas encore de trophées. Atteignez vos objectifs pour débloquer des récompenses !
        </EmptyState>
      </Card>
    );
  }

  // Group by tier
  const byTier = { diamond: [], gold: [], silver: [], bronze: [] };
  for (const t of trophies) (byTier[t.tier] ||= []).push(t);

  return (
    <Card title={`🏆 Trophées (${trophies.length})`}>
      <div className="space-y-4">
        {['diamond', 'gold', 'silver', 'bronze'].map((tier) => {
          const items = byTier[tier];
          if (!items?.length) return null;
          const style = TIER_STYLES[tier];
          return (
            <div key={tier}>
              <div className={`text-[10px] uppercase tracking-wider mb-2 ${style.text}`}>
                {tier === 'diamond' ? '💎 Diamant' : tier === 'gold' ? '🥇 Or' : tier === 'silver' ? '🥈 Argent' : '🥉 Bronze'}
                {' '}({items.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((trophy) => (
                  <div
                    key={trophy.id}
                    className={`${style.bg} border ${style.border} rounded-lg p-3`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{trophy.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${style.text}`}>{trophy.title}</div>
                        {trophy.description && (
                          <p className="text-xs text-mute mt-0.5 line-clamp-2">{trophy.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-mute">
                          {trophy.achieved_value != null && trophy.target_value != null && (
                            <span>{trophy.achieved_value} / {trophy.target_value}</span>
                          )}
                          {trophy.discipline_score != null && (
                            <span>Discipline: {trophy.discipline_score}%</span>
                          )}
                          {trophy.duration_days != null && (
                            <span>{trophy.duration_days}j</span>
                          )}
                          {trophy.phase_name && (
                            <span>{trophy.phase_name}</span>
                          )}
                        </div>
                        <div className="text-[9px] text-mute mt-1">
                          {new Date(trophy.achieved_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                          {trophy.program_name && ` · ${trophy.program_name}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
