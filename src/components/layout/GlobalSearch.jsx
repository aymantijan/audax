import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, TrendingUp, Wallet, Flame, BookOpen, Library, Handshake, GitBranch } from 'lucide-react';
import { buildSearchIndex, searchIndex } from '../../utils/global-search';

const DOMAIN_ICON = { Trading: TrendingUp, Finance: Wallet, Habits: Flame, Learning: BookOpen, Reading: Library, Deals: Handshake, Skills: GitBranch };

// Global command-palette search — Ctrl/Cmd+K anywhere, or the search icon in
// the navbar. Reads a fresh index from every relevant store on each open
// (buildSearchIndex is a `.getState()` snapshot, cheap enough to rebuild per
// open rather than kept live — see global-search.js for why that's safe).
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const index = useMemo(() => (open ? buildSearchIndex() : []), [open]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);

  const go = (item) => {
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDownInput = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIdx]) { go(results[activeIdx]); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-mute hover:text-ink hover:bg-card transition-colors cursor-pointer" title="Search (Ctrl/Cmd+K)">
        <Search size={18} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg bg-card border border-line rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <Search size={16} className="text-mute shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKeyDownInput}
            placeholder="Search trades, transactions, habits, courses, books, deals, skills…"
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-mute"
          />
          <button onClick={() => setOpen(false)} className="text-mute hover:text-ink cursor-pointer shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-mute">No matches for "{query}".</div>
          )}
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-mute">Start typing to search across the whole app.</div>
          )}
          {results.map((item, i) => {
            const Icon = DOMAIN_ICON[item.domain] || Search;
            return (
              <button
                key={item.id}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer ${i === activeIdx ? 'bg-surface' : ''}`}
              >
                <Icon size={15} className="text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{item.label}</div>
                  {item.sub && <div className="text-[11px] text-mute truncate">{item.sub}</div>}
                </div>
                <span className="text-[10px] text-mute uppercase tracking-wide shrink-0">{item.domain}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
