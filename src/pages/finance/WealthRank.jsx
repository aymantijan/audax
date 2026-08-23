import { useMemo, useState } from 'react';
import { Crown, Search, Crosshair, Lock, Check, Star } from 'lucide-react';
import { useAccountingStore } from '../../store/accountingStore';
import { WEALTH_LADDER, WEALTH_ERAS, wealthRankFor } from '../../utils/wealth-ranks';
import { fmtMAD } from '../../utils/formatters';
import { Card, Stat, Badge, EmptyState } from '../../components/common/ui';

const PAGE_SIZE = 50;

// Personal, currency-only milestone ladder — deliberately separate from the
// Leaderboard's grade system (which is XP-based and includes trading/health/
// learning/growth). This one reads PURELY off net worth (ANCC) in DH, and —
// unlike a grade — it's a LIVE reading: it can go down if your ANCC drops,
// same as your actual wealth can. See utils/wealth-ranks.js.
export default function WealthRank() {
  const ancc = useAccountingStore((s) => s.getNetWorth().ancc);
  const rank = useMemo(() => wealthRankFor(ancc), [ancc]);

  const [search, setSearch] = useState('');
  const [era, setEra] = useState('all');
  const [page, setPage] = useState(Math.floor((rank.current.level - 1) / PAGE_SIZE));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WEALTH_LADDER.filter((r) => {
      if (era !== 'all' && r.era !== era) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, era]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const jumpToMine = () => {
    setSearch('');
    setEra('all');
    setPage(Math.floor((rank.current.level - 1) / PAGE_SIZE));
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--warning), var(--accent-secondary))' }}
            >
              <Crown size={28} className="text-black" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-mute uppercase tracking-wide">Rang {rank.current.level} · {rank.current.era}</div>
              <div className="text-xl font-bold truncate">{rank.current.name}</div>
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-mute mb-1">
                  <span>{rank.next ? `Suivant : ${rank.next.name}` : 'Rang maximum atteint'}</span>
                  <span>{Math.round(rank.progress)}%</span>
                </div>
                <div className="w-full bg-surface rounded-full overflow-hidden h-2">
                  <div className="h-full rounded-full" style={{ width: `${rank.progress}%`, background: 'linear-gradient(90deg, var(--warning), var(--accent-secondary))' }} />
                </div>
                {rank.next && (
                  <div className="text-[10px] text-mute mt-1">
                    Palier suivant : {fmtMAD(rank.next.threshold)} · il reste {fmtMAD(Math.max(0, rank.next.threshold - ancc))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
        <Stat label="Patrimoine net (ANCC)" value={fmtMAD(ancc)} sub="détermine directement le rang" color="var(--warning)" />
      </div>

      <p className="text-xs text-mute">
        Contrairement au grade du Leaderboard (basé sur l'XP cumulé, jamais perdu), ce rang est une lecture <strong>en direct</strong> de votre patrimoine net —
        il peut redescendre si votre ANCC baisse, exactement comme une vraie fortune.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Chercher un rang…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={era} onChange={(e) => { setEra(e.target.value); setPage(0); }}>
          <option value="all">Toutes les ères</option>
          {WEALTH_ERAS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={jumpToMine} className="flex items-center gap-1.5 text-sm text-black bg-accent rounded-lg px-3 py-2 cursor-pointer font-semibold hover:opacity-90">
          <Crosshair size={14} /> Mon rang
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line bg-surface/50">
                  <th className="py-2.5 px-4 w-16">Rang</th>
                  <th className="py-2.5 px-4">Nom</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Ère</th>
                  <th className="py-2.5 px-4 text-right">Palier (ANCC)</th>
                  <th className="py-2.5 px-4 text-center w-24">Statut</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const achieved = r.level <= rank.current.level;
                  const isCurrent = r.level === rank.current.level;
                  return (
                    <tr
                      key={r.level}
                      className="border-b border-line/40"
                      style={isCurrent ? { background: 'color-mix(in srgb, var(--warning) 16%, transparent)' } : undefined}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-mute">{r.level}</td>
                      <td className="py-2.5 px-4">
                        <span className={isCurrent ? 'font-bold text-accent' : achieved ? 'font-medium' : 'text-mute'}>{r.name}</span>
                        {isCurrent && <Badge color="var(--warning)"> vous êtes ici</Badge>}
                      </td>
                      <td className="py-2.5 px-4 hidden sm:table-cell text-mute text-xs">{r.era}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmtMAD(r.threshold)}</td>
                      <td className="py-2.5 px-4 text-center">
                        {isCurrent ? (
                          <Star size={14} className="inline text-warning" fill="currentColor" style={{ color: 'var(--warning)' }} />
                        ) : achieved ? (
                          <Check size={14} className="inline text-good" style={{ color: 'var(--success)' }} />
                        ) : (
                          <Lock size={13} className="inline text-mute" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8"><EmptyState>Aucun rang ne correspond à ces filtres.</EmptyState></div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-mute">
          Affichage {filtered.length ? clampedPage * PAGE_SIZE + 1 : 0}–{Math.min(filtered.length, (clampedPage + 1) * PAGE_SIZE)} sur {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            Précédent
          </button>
          <span className="text-sm text-mute">Page {clampedPage + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1} className="text-sm border border-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 hover:border-accent">
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
