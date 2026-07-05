import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, BookMarked, Pencil, Trash2 } from 'lucide-react';
import { useReadingsStore } from '../store/readingsStore';
import { GENRE_GROUPS } from '../utils/reading-genres';
import { scoreStyle } from '../utils/score-colors';
import { Card, Stat, Button, Field, Input, Select, Textarea, Badge, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import SkillPicker from '../components/common/SkillPicker';

const blank = () => ({
  title: '', author: '', genre: GENRE_GROUPS[0].items[0], pages: '', words: '', description: '', year: new Date().getFullYear(), popularity: 50, linkedSkills: [],
});

export default function Library() {
  const { library, progress, addBookToLibrary, editBook, deleteBook, addToReading, isReading, seedCatalog } = useReadingsStore();
  // One-shot import of the built-in catalog (5 books per genre, every genre).
  useEffect(() => {
    seedCatalog();
  }, [seedCatalog]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [minPages, setMinPages] = useState('');
  const [maxPages, setMaxPages] = useState('');

  const authors = useMemo(() => [...new Set(library.map((b) => b.author))].filter(Boolean).sort(), [library]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library
      .filter((b) => authorFilter === 'all' || b.author === authorFilter)
      .filter((b) => genreFilter === 'all' || b.genre === genreFilter)
      .filter((b) => !minPages || b.pages >= Number(minPages))
      .filter((b) => !maxPages || b.pages <= Number(maxPages))
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [library, search, authorFilter, genreFilter, minPages, maxPages]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim() || !Number(form.pages)) return;
    addBookToLibrary(form);
    setModal(false);
    setForm(blank());
  };

  const editFields = [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'author', label: 'Author', type: 'text' },
    { name: 'genre', label: 'Genre', type: 'select', options: GENRE_GROUPS.flatMap((g) => g.items) },
    { name: 'year', label: 'Year of release', type: 'number' },
    { name: 'pages', label: 'Pages', type: 'number', min: 1 },
    { name: 'words', label: 'Words', type: 'number', min: 1, hint: 'Leave as-is to keep the ~250 words/page estimate' },
    { name: 'popularity', label: 'Popularity (/100)', type: 'number', min: 0, max: 100 },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/learning/readings" className="inline-flex items-center gap-1 text-mute hover:text-ink text-sm cursor-pointer mb-2">
            <ArrowLeft size={14} /> Readings
          </Link>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-mute text-sm mt-1">Every book you've catalogued. Add one to start reading it.</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Book</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Books catalogued" value={library.length} />
        <Stat label="Currently reading" value={progress.filter((p) => p.status !== 'completed').length} />
        <Stat label="Completed" value={progress.filter((p) => p.status === 'completed').length} />
        <Stat label="Authors" value={authors.length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Search title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
          <option value="all">All authors</option>
          {authors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="all">All genres</option>
          {GENRE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => <option key={i} value={i}>{i}</option>)}
            </optgroup>
          ))}
        </select>
        <input type="number" placeholder="Min pages" value={minPages} onChange={(e) => setMinPages(e.target.value)} className="w-24 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute" />
        <input type="number" placeholder="Max pages" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} className="w-24 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState>
            <BookMarked className="mx-auto mb-2 text-mute" size={28} />
            {library.length === 0 ? 'No books catalogued yet. Add the first one.' : 'No books match these filters.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((b) => {
            const pop = scoreStyle(b.popularity);
            const reading = isReading(b.id);
            return (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{b.title}</h3>
                    <div className="text-xs text-mute mt-0.5">{b.author} · {b.year}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(b)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Delete "${b.title}" from the library?`)) deleteBook(b.id); }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge color="var(--accent-secondary)">{b.genre}</Badge>
                  <Badge color={reading ? 'var(--success)' : 'var(--text-secondary)'}>{reading ? 'Reading' : 'Not started'}</Badge>
                </div>

                {b.description && <p className="text-sm text-mute mb-3 line-clamp-2">{b.description}</p>}

                <div className="flex items-center justify-between text-xs text-mute mb-3">
                  <span>{b.pages.toLocaleString()} pages · {b.words.toLocaleString()} words</span>
                  <span className="font-semibold" style={pop.style}>{b.popularity}/100 · {pop.label}</span>
                </div>

                <Button className="w-full" variant={reading ? 'secondary' : 'primary'} disabled={reading} onClick={() => addToReading(b.id)}>
                  {reading ? 'Already reading' : 'Add to Readings'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Custom add form (needs a description textarea + skill picker alongside the fields) */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-10 px-4" onClick={() => setModal(false)}>
          <div className="bg-card border border-line rounded-xl p-6 w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-5">Add Book to Library</h2>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
                <Field label="Author"><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
                <Field label="Genre">
                  <Select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
                    {GENRE_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((i) => <option key={i} value={i}>{i}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Year of release"><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
                <Field label="Pages"><Input type="number" min="1" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} /></Field>
                <Field label="Words (optional)" hint="Defaults to ~250/page"><Input type="number" min="1" value={form.words} onChange={(e) => setForm({ ...form, words: e.target.value })} /></Field>
                <Field label="Popularity (/100)">
                  <input type="range" min="0" max="100" value={form.popularity} onChange={(e) => setForm({ ...form, popularity: Number(e.target.value) })} className="w-full mt-2" />
                </Field>
              </div>
              <Field label="Description">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short summary…" />
              </Field>
              <Field label="Linked skills (optional — XP awarded while reading)">
                <SkillPicker value={form.linkedSkills} onChange={(ids) => setForm({ ...form, linkedSkills: ids })} />
              </Field>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
                <Button type="submit">Add to library</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit Book"
          fields={editFields}
          initial={editing}
          wide
          onSave={(values) => editBook(editing.id, values)}
          onDelete={() => deleteBook(editing.id)}
        />
      )}
    </div>
  );
}
