import { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { SKILL_TREE, SKILL_MAP } from '../../utils/constants';
import { useSkillStore } from '../../store/skillStore';
import { Badge } from './ui';

// Searchable skill selector for a 200+ skill tree.
// multi: value = [ids], onChange([ids]) · single: value = id|'', onChange(id)
export default function SkillPicker({ value, onChange, multi = true, placeholder = 'Search skills…' }) {
  const skills = useSkillStore((s) => s.skills);
  const [query, setQuery] = useState('');

  const selected = multi ? value : value ? [value] : [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SKILL_TREE.filter(
      (d) =>
        !skills[d.id]?.locked &&
        !selected.includes(d.id) &&
        (d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.subcategory.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [query, skills, selected]);

  const add = (id) => {
    if (multi) onChange([...selected, id]);
    else onChange(id);
    setQuery('');
  };
  const remove = (id) => {
    if (multi) onChange(selected.filter((s) => s !== id));
    else onChange('');
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-accent/10 text-accent border border-accent/40">
              {SKILL_MAP[id]?.name || id}
              <button type="button" onClick={() => remove(id)} className="hover:text-bad cursor-pointer">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input
          className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 bg-surface border border-line rounded-lg max-h-52 overflow-y-auto divide-y divide-line/50">
          {results.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => add(d.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-card cursor-pointer flex items-center justify-between gap-2"
            >
              <span>{d.name}</span>
              <Badge color="var(--accent-secondary)">{d.category} · {d.subcategory}</Badge>
            </button>
          ))}
        </div>
      )}
      {query && !results.length && <div className="text-xs text-mute mt-1">No unlocked skills match "{query}".</div>}
    </div>
  );
}
