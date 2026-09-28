import { useMemo } from 'react';
import { Lock, Award } from 'lucide-react';
import { FAMILY_MAP, MODELS } from '../../utils/skill-families';

const COLOR = { locked: 'var(--border)', available: 'var(--accent-secondary)', active: 'var(--success)', mastered: 'var(--accent-primary)' };

// The same tree as a readable list: by model, then branch. Used when 3D is not
// available, and by anyone who prefers reading to flying around.
export default function SkillList({ states, visibleIds, query, onSelect }) {
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    for (const m of MODELS) {
      const fams = visibleIds.map((id) => FAMILY_MAP[id]).filter((f) => f && f.model === m.id && (!q || f.name.toLowerCase().includes(q) || f.branch.toLowerCase().includes(q)));
      if (!fams.length) continue;
      const branches = new Map();
      for (const f of fams.sort((a, b) => (states[b.id]?.level || 0) - (states[a.id]?.level || 0) || a.name.localeCompare(b.name))) {
        if (!branches.has(f.branch)) branches.set(f.branch, []);
        branches.get(f.branch).push(f);
      }
      out.push({ model: m, branches: [...branches] });
    }
    return out;
  }, [visibleIds, states, query]);

  if (!groups.length) return <p className="text-sm text-mute py-6 text-center">Aucune compétence ne correspond.</p>;

  return (
    <div className="space-y-6">
      {groups.map(({ model, branches }) => (
        <section key={model.id}>
          <h2 className="text-sm font-semibold mb-2">{model.label}</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            {branches.map(([branch, fams]) => (
              <div key={branch}>
                <div className="text-[11px] uppercase tracking-wide text-mute mb-1">{branch}</div>
                <ul>
                  {fams.map((f) => {
                    const st = states[f.id];
                    return (
                      <li key={f.id}>
                        <button type="button" onClick={() => onSelect(f.id)} className="w-full flex items-center gap-2 py-1.5 text-left text-sm hover:text-accent cursor-pointer">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR[st?.status] }} />
                          <span className="truncate">{f.name}</span>
                          {st?.status === 'locked' && <Lock size={11} className="text-mute shrink-0" />}
                          {st?.capped && <Award size={12} className="shrink-0" style={{ color: 'var(--warning)' }} />}
                          <span className="ml-auto flex gap-0.5 shrink-0" aria-label={`niveau ${st?.level || 0} sur 5`}>
                            {[1, 2, 3, 4, 5].map((l) => (
                              <span key={l} className="w-2.5 h-1.5 rounded-sm" style={{ background: l <= (st?.level || 0) ? COLOR[st.status] : 'var(--border)' }} />
                            ))}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
