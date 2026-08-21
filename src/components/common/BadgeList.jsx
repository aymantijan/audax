import { Award } from 'lucide-react';
import { Card } from './ui';

const TIER_COLOR = { bronze: '#c17a4a', silver: '#9aa4b2', gold: 'var(--warning)' };

// Shared achievement-badge grid — one row of pills, earned ones colored (by
// tier when the domain's BADGE_DEFS carry one, plain accent otherwise),
// unearned ones greyed out. Used by every domain that has a getBadges()
// selector (Health, Engineering, Trading, Deals, Habits, Finance) so the
// same badges → same look everywhere, instead of re-implementing this markup
// per page.
export default function BadgeList({ badges, title = 'Badges' }) {
  if (!badges?.length) return null;
  return (
    <Card title={title}>
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => {
          const color = b.earned ? TIER_COLOR[b.tier] || 'var(--accent-primary)' : undefined;
          return (
            <span
              key={b.id}
              title={b.tier ? `${b.tier[0].toUpperCase()}${b.tier.slice(1)}` : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${b.earned ? '' : 'border-line text-mute opacity-50'}`}
              style={b.earned ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
            >
              <Award size={12} /> {b.name}
            </span>
          );
        })}
      </div>
    </Card>
  );
}
