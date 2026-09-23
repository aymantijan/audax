import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Plus, Minus, Trash2, Pencil, Flame, BookOpen, CheckCircle2, GraduationCap, Compass } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useReadingsStore } from '../store/readingsStore';
import { useLearningStore } from '../store/learningStore';
import { resourcesOf } from '../utils/tracks';
import { isAcademic } from '../utils/academic';
import { Card, Button, ProgressBar, Modal, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import { SectionHeader, BigStat, tint } from '../components/learning/design';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const PIE_COLORS = ['#00d9ff', '#b366ff', '#00d97f', '#ffa500', '#ff6b6b', '#7aa2ff'];
const fr = (n) => (n ?? 0).toLocaleString('fr-FR');

/**
 * Lectures — one reading tracker for the whole app. Books linked to a course
 * or track (via its Resources) show the same page progress here and there.
 * `embedded`: rendered as the Apprentissage "Lectures" tab (no page header).
 */
export default function Readings({ embedded = false }) {
  const { library, progress, addPage, removePage, setPagesRead, removeFromReading, adjustBookCounts, totalPagesFor, totalWordsFor, getStreak } = useReadingsStore();
  const courses = useLearningStore((s) => s.courses);
  const [editingCounts, setEditingCounts] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [pageDraft, setPageDraft] = useState({});

  // bookId → courses/tracks that list it as a resource
  const linkedBy = useMemo(() => {
    const map = {};
    for (const c of courses) {
      for (const r of resourcesOf(c)) if (r.bookId) (map[r.bookId] ||= []).push(c);
    }
    return map;
  }, [courses]);

  const rows = useMemo(() => progress.map((p) => {
    const book = library.find((b) => b.id === p.bookId);
    const totalPages = totalPagesFor(p);
    const totalWords = totalWordsFor(p);
    const pct = totalPages > 0 ? Math.min(100, Math.round((p.pagesRead / totalPages) * 100)) : 0;
    return { ...p, book, totalPages, totalWords, pct, wordsRead: totalWords > 0 ? Math.round((pct / 100) * totalWords) : 0 };
  }), [progress, library]); // eslint-disable-line react-hooks/exhaustive-deps

  const reading = rows.filter((r) => r.status !== 'completed' && r.book);
  const completed = rows.filter((r) => r.status === 'completed' && r.book);
  const streak = getStreak();
  const totalPagesRead = rows.reduce((a, r) => a + r.pagesRead, 0);
  const totalWordsRead = rows.reduce((a, r) => a + r.wordsRead, 0);

  const byGenre = useMemo(() => {
    const map = {};
    for (const r of rows) if (r.book) map[r.book.genre] = (map[r.book.genre] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rows]);

  // Plain render function (not a component) so the page input keeps focus while typing.
  const bookRow = (r) => {
    const done = r.status === 'completed';
    const links = linkedBy[r.bookId] || [];
    return (
      <div key={r.id} className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-14 rounded-md shrink-0 flex items-center justify-center" style={{ background: tint(done ? 'var(--success)' : 'var(--accent-primary)', 15) }}>
            {done ? <CheckCircle2 size={18} className="text-good" /> : <BookOpen size={18} className="text-accent" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink truncate">{r.book.title}</div>
            <div className="text-[11px] text-mute">{r.book.author} · {r.book.genre}</div>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {links.map((c) => (
                  <Link key={c.id} to={`/learning/course/${c.id}`} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-mute hover:text-accent hover:border-accent">
                    {isAcademic(c) ? <GraduationCap size={10} /> : <Compass size={10} />}{c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1.5 text-mute hover:text-accent cursor-pointer" onClick={() => setEditingCounts(r)} title="Ajuster pages / mots"><Pencil size={13} /></button>
            <button className="p-1.5 text-mute hover:text-bad cursor-pointer" onClick={() => setRemoving(r)} title="Retirer des lectures"><Trash2 size={13} /></button>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={r.pct} height={7} color={done ? 'var(--success)' : 'var(--accent-primary)'} />
          <div className="flex items-center gap-2 mt-2 text-[11px] text-mute flex-wrap">
            <span className="tabular-nums">{fr(r.pagesRead)} / {fr(r.totalPages)} pages · {r.pct}%</span>
            <span className="hidden sm:inline">· ~{fr(r.wordsRead)} mots</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="secondary" className="!px-2 !py-1" onClick={() => removePage(r.id)} disabled={r.pagesRead <= 0}><Minus size={12} /></Button>
              <Button className="!px-2.5 !py-1 text-xs" onClick={() => addPage(r.id)} disabled={done}><span className="flex items-center gap-1"><Plus size={12} /> Page</span></Button>
              <form onSubmit={(e) => { e.preventDefault(); const v = Number(pageDraft[r.id]); if (v >= 0 && pageDraft[r.id] !== '') setPagesRead(r.id, v); setPageDraft((d) => ({ ...d, [r.id]: '' })); }}>
                <input type="number" min="0" placeholder="Aller à p." value={pageDraft[r.id] ?? ''} onChange={(e) => setPageDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  className="w-24 bg-surface border border-line rounded-lg px-2 py-1 text-xs text-ink placeholder:text-mute" />
              </form>
            </div>
          </div>
          {r.completedAt && <div className="text-[10px] text-mute mt-1">Terminé le {new Date(r.completedAt).toLocaleDateString('fr-FR')}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-5 max-w-6xl mx-auto'}>
      {!embedded && (
        <div>
          <Link to="/learning" className="text-sm text-mute hover:text-ink">← Apprentissage</Link>
          <h1 className="text-2xl font-bold text-ink mt-1">Lectures</h1>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <SectionHeader icon={BookOpen} title="Mes lectures" subtitle="Une page lue = de l'XP et un jour de série. Les livres liés à un cours ou un parcours y sont suivis au même endroit." />
        <Link to="/learning/readings/library"><Button variant="secondary"><span className="flex items-center gap-1.5"><Library size={14} /> Bibliothèque</span></Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat label="Série de lecture" value={<span className="flex items-center gap-1"><Flame size={18} />{streak} j</span>} sub={streak ? 'jours d’affilée' : 'lisez une page aujourd’hui'} color={streak ? 'var(--warning)' : undefined} />
        <BigStat label="En cours" value={reading.length} sub={`${completed.length} terminé(s)`} />
        <BigStat label="Pages lues" value={fr(totalPagesRead)} />
        <BigStat label="Mots lus (est.)" value={totalWordsRead >= 1000 ? `${(totalWordsRead / 1000).toFixed(1).replace('.', ',')} k` : totalWordsRead} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>
            <BookOpen className="mx-auto mb-2 text-mute" size={28} />
            Aucun livre en cours. Parcourez la <Link to="/learning/readings/library" className="text-accent hover:underline">bibliothèque</Link>, ou ajoutez un livre comme ressource d'un cours ou d'un parcours.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {reading.map(bookRow)}
            {completed.length > 0 && (
              <>
                <div className="text-xs font-semibold text-mute uppercase tracking-wide pt-2">Terminés</div>
                {completed.map(bookRow)}
              </>
            )}
          </div>
          <Card>
            <SectionHeader title="Par genre" />
            {byGenre.length ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byGenre} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                      {byGenre.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {byGenre.map((g, i) => (
                    <div key={g.name} className="flex items-center gap-2 text-xs text-mute">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate">{g.name}</span><span className="tabular-nums">{g.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState>Pas encore de données.</EmptyState>}
          </Card>
        </div>
      )}

      {editingCounts && (
        <EntityFormModal
          open={!!editingCounts}
          onClose={() => setEditingCounts(null)}
          title={`Ajuster « ${editingCounts.book?.title} »`}
          fields={[
            { name: 'customPages', label: 'Nombre réel de pages', type: 'number', min: 1, hint: `Par défaut : ${editingCounts.book?.pages}. Vide = valeur par défaut.` },
            { name: 'customWords', label: 'Nombre réel de mots', type: 'number', min: 1, hint: `Par défaut : ${editingCounts.book?.words}. Vide = valeur par défaut.` },
          ]}
          initial={{ id: editingCounts.id, customPages: editingCounts.customPages ?? '', customWords: editingCounts.customWords ?? '' }}
          submitLabel="Enregistrer"
          onSave={(values) => adjustBookCounts(editingCounts.id, values)}
        />
      )}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Retirer ce livre de vos lectures ?">
        <p className="text-sm text-mute">« {removing?.book?.title} » reste dans la bibliothèque ; seule votre progression de lecture est supprimée.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Annuler</Button>
          <Button variant="danger" onClick={() => { removeFromReading(removing.id); setRemoving(null); }}>Retirer</Button>
        </div>
      </Modal>
    </div>
  );
}
