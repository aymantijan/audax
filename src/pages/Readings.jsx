import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Plus, Minus, Trash2, Pencil, Flame, BookOpen, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useReadingsStore } from '../store/readingsStore';
import { scoreStyle } from '../utils/score-colors';
import { fmtDate } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, ProgressBar, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const PIE_COLORS = ['#00d9ff', '#b366ff', '#00d97f', '#ffa500', '#ff6b6b', '#7aa2ff'];

export default function Readings() {
  const { library, progress, addPage, removePage, removeFromReading, adjustBookCounts, totalPagesFor, totalWordsFor, getStreak } = useReadingsStore();
  const [editingCounts, setEditingCounts] = useState(null); // progress row being adjusted

  const rows = useMemo(
    () =>
      progress.map((p) => {
        const book = library.find((b) => b.id === p.bookId);
        const totalPages = totalPagesFor(p);
        const totalWords = totalWordsFor(p);
        const pct = totalPages > 0 ? Math.min(100, Math.round((p.pagesRead / totalPages) * 100)) : 0;
        const wordsRead = totalWords > 0 ? Math.round((pct / 100) * totalWords) : 0;
        return { ...p, book, totalPages, totalWords, pct, wordsRead };
      }),
    [progress, library]
  );

  const reading = rows.filter((r) => r.status !== 'completed');
  const completed = rows.filter((r) => r.status === 'completed');
  const streak = getStreak();

  const totalPagesRead = rows.reduce((a, r) => a + r.pagesRead, 0);
  const totalWordsRead = rows.reduce((a, r) => a + r.wordsRead, 0);
  const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length) : 0;

  const byGenre = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!r.book) continue;
      map[r.book.genre] = (map[r.book.genre] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const progressChart = rows
    .filter((r) => r.book)
    .map((r) => ({ name: r.book.title.length > 14 ? r.book.title.slice(0, 14) + '…' : r.book.title, pct: r.pct }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Readings</h1>
          <p className="text-mute text-sm mt-1">Track pages, earn XP, build your streak.</p>
        </div>
        <Link to="/learning/readings/library">
          <Button variant="secondary">
            <span className="flex items-center gap-2"><Library size={15} /> Browse Library</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Reading streak" value={streak} sub={streak > 0 ? 'days' : 'log a page today'} color={streak > 0 ? 'var(--warning)' : undefined} />
        <Stat label="Books in progress" value={reading.length} />
        <Stat label="Books completed" value={completed.length} />
        <Stat label="Pages read" value={totalPagesRead.toLocaleString()} />
        <Stat label="Words read (est.)" value={totalWordsRead >= 1000 ? `${(totalWordsRead / 1000).toFixed(1)}k` : totalWordsRead} sub={`avg ${avgProgress}% complete`} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>
            <BookOpen className="mx-auto mb-2 text-mute" size={28} />
            No books yet. <Link to="/learning/readings/library" className="text-accent hover:underline">Browse the Library</Link> and add one to start reading.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Progress by Book">
              {progressChart.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={progressChart} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                      {progressChart.map((d, i) => <Cell key={i} fill={scoreStyle(d.pct).color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No data yet.</EmptyState>
              )}
            </Card>
            <Card title="By Genre">
              {byGenre.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byGenre} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {byGenre.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No genre data yet.</EmptyState>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {rows.map((r) => {
              if (!r.book) return null;
              const sc = scoreStyle(r.pct);
              return (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{r.book.title}</h3>
                        {r.status === 'completed' && <Badge color="var(--success)"><span className="flex items-center gap-1"><CheckCircle2 size={11} /> Completed</span></Badge>}
                      </div>
                      <div className="text-xs text-mute mt-0.5">{r.book.author} · {r.book.genre}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditingCounts(r)} title="Adjust real page/word counts">
                        <Pencil size={14} />
                      </button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Remove "${r.book.title}" from your readings?`)) removeFromReading(r.id); }} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <ProgressBar value={r.pct} max={100} height={10} color={sc.color} />
                  <div className="flex items-center justify-between mt-2 text-xs text-mute">
                    <span>
                      {r.pagesRead} / {r.totalPages} pages
                      {r.book.customPages !== null && r.customPages !== null ? ' (adjusted)' : ''}
                    </span>
                    <span style={sc.style} className={sc.glow ? 'font-semibold' : 'font-medium'}>
                      {r.pct}% · {sc.label}
                    </span>
                    <span>~{r.wordsRead.toLocaleString()} / {r.totalWords.toLocaleString()} words</span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="secondary" onClick={() => removePage(r.id)} disabled={r.pagesRead <= 0}>
                      <Minus size={14} />
                    </Button>
                    <Button onClick={() => addPage(r.id)} disabled={r.status === 'completed'}>
                      <span className="flex items-center gap-1"><Plus size={14} /> Page read</span>
                    </Button>
                    {r.completedAt && <span className="text-[11px] text-mute ml-auto">Finished {fmtDate(r.completedAt)}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {editingCounts && (
        <EntityFormModal
          open={!!editingCounts}
          onClose={() => setEditingCounts(null)}
          title={`Adjust "${editingCounts.book?.title}"`}
          fields={[
            { name: 'customPages', label: 'Real page count', type: 'number', min: 1, hint: `Book default: ${editingCounts.book?.pages}. Leave blank to use default.` },
            { name: 'customWords', label: 'Real word count', type: 'number', min: 1, hint: `Book default: ${editingCounts.book?.words}. Leave blank to use default.` },
          ]}
          initial={{ id: editingCounts.id, customPages: editingCounts.customPages ?? '', customWords: editingCounts.customWords ?? '' }}
          submitLabel="Save"
          onSave={(values) => adjustBookCounts(editingCounts.id, values)}
        />
      )}
    </div>
  );
}
