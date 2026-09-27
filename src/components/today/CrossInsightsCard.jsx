import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Moon } from 'lucide-react';
import { useLifeLinks, LinksList } from './LifeLinks';
import { useHabitStore } from '../../store/habitStore';
import { useTradingStore } from '../../store/tradingStore';
import { useFocusStore } from '../../store/focusStore';
import { useLearningStore } from '../../store/learningStore';
import { useAuthStore } from '../../store/authStore';
import { crossInsights, MIN_DAYS } from '../../utils/cross-insights';
import { isModuleEnabled } from '../../utils/navigation';
import { fmtMoney } from '../../utils/formatters';
import { Card } from '../common/ui';

// Links between sections: the strongest findings of the Chronologie (10 days
// each side); until there are some, the earlier sleep comparisons (5 days).
export default function CrossInsightsCard() {
  const user = useAuthStore((s) => s.user);
  const energyLogs = useHabitStore((s) => s.energyLogs);
  const trades = useTradingStore((s) => s.trades);
  const currency = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId)?.currency || 'USD');
  const sessions = useFocusStore((s) => s.sessions);
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const attendance = useLearningStore((s) => s.attendance);
  const trading = isModuleEnabled(user, 'trading');
  const links = useLifeLinks();

  const items = useMemo(() => crossInsights({
    energyLogs, trades: trading ? trades : [], sessions, courses, academic, attendance,
    formatMoney: (v) => fmtMoney(v, 0, currency),
  }), [energyLogs, trades, trading, sessions, courses, academic, attendance, currency]);

  return (
    <Card title={<span className="flex items-center gap-2"><Link2 size={15} /> Liens entre tes domaines</span>}>
      {links.findings.length > 0 && (
        <>
          <LinksList links={links} max={3} />
          <div className="flex justify-between gap-2 text-[11px] text-mute mt-2">
            <span>Un lien observé, pas une cause prouvée.</span>
            <Link to="/chronologie?vue=liens" className="text-accent hover:underline whitespace-nowrap">Tous les liens</Link>
          </div>
        </>
      )}
      {links.findings.length > 0 ? null : items.length ? (
        <ul className="space-y-2.5">
          {items.map((i) => (
            <li key={i.key} className="flex items-start gap-2.5 text-sm">
              <Moon size={15} className="mt-0.5 shrink-0" style={{ color: i.better ? 'var(--success)' : 'var(--warning)' }} />
              <span>{i.text} <span className="text-[11px] text-mute">({i.detail})</span></span>
            </li>
          ))}
          <li className="text-[11px] text-mute">Une tendance sur tes propres données, pas une règle : d’autres choses jouent aussi.</li>
        </ul>
      ) : (
        <p className="text-sm text-mute">Fais ton check-in du matin (heure de coucher et de réveil) : après au moins {MIN_DAYS} bonnes nuits et {MIN_DAYS} nuits courtes, VAUDAX te montrera l’effet de ton sommeil sur tes cours, ta concentration et ton trading.</p>
      )}
    </Card>
  );
}
