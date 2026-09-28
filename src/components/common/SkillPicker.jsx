import { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { FAMILIES, MODEL_MAP, entryNodeOf, familyIdOf, skillLabel } from '../../utils/skill-families';
import { Badge } from './ui';

// Searchable compétence selector. Stored values stay node ids (what the XP
// engines award to); a picked compétence is stored as its first node.
// multi: value = [ids], onChange([ids]) · single: value = id|'', onChange(id)
export default function SkillPicker({ value, onChange, multi = true, placeholder = 'Chercher une compétence…' }) {
  const [query, setQuery] = useState('');

  const selected = multi ? value : value ? [value] : [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(selected.map(familyIdOf));
    return FAMILIES.filter(
      (f) => !taken.has(f.id) && (f.name.toLowerCase().includes(q) || f.branch.toLowerCase().includes(q) || MODEL_MAP[f.model]?.label.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [query, selected]);

  const add = (familyId) => {
    const id = entryNodeOf(familyId);
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
              {skillLabel(id)}
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
              <Badge color="var(--accent-secondary)">{MODEL_MAP[d.model]?.label} · {d.branch}</Badge>
            </button>
          ))}
        </div>
      )}
      {query && !results.length && <div className="text-xs text-mute mt-1">Aucune compétence ne correspond à « {query} ».</div>}
    </div>
  );
}
