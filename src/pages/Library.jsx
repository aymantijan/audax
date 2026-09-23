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
    { name: 'title', label: 'Titre', type: 'text' },
    { name: 'author', label: 'Auteur', type: 'text' },
    { name: 'genre', label: 'Genre', type: 'select', options: GENRE_GROUPS.flatMap((g) => g.items) },
    { name: 'year', label: 'Année de parution', type: 'number' },
    { name: 'pages', label: 'Pages', type: 'number', min: 1 },
    { name: 'words', label: 'Mots', type: 'number', min: 1, hint: 'Laisser tel quel pour garder l’estimation de ~250 mots/page' },
    { name: 'popularity', label: 'Popularité (/100)', type: 'number', min: 0, max: 100 },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/learning?tab=readings" className="inline-flex items-center gap-1 text-mute hover:text-ink text-sm cursor-pointer mb-2">
            <ArrowLeft size={14} /> Lectures
          </Link>
          <h1 className="text-2xl font-bold">Bibliothèque</h1>
          <p className="text-mute text-sm mt-1">Tous vos livres. Ajoutez-en un à vos lectures pour suivre les pages lues.</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Ajouter un livre</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Livres au catalogue" value={library.length} />
        <Stat label="En cours de lecture" value={progress.filter((p) => p.status !== 'completed').length} />
        <Stat label="Terminés" value={progress.filter((p) => p.status === 'completed').length} />
        <Stat label="Auteurs" value={authors.length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Rechercher un titre ou un auteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
          <option value="all">Tous les auteurs</option>
          {authors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="all">Tous les genres</option>
          {GENRE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => <option key={i} value={i}>{i}</option>)}
            </optgroup>
          ))}
        </select>
        <input type="number" placeholder="Pages min" value={minPages} onChange={(e) => setMinPages(e.target.value)} className="w-24 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute" />
        <input type="number" placeholder="Pages max" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} className="w-24 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState>
            <BookMarked className="mx-auto mb-2 text-mute" size={28} />
            {library.length === 0 ? 'Aucun livre pour le moment. Ajoutez le premier.' : 'Aucun livre ne correspond à ces filtres.'}
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
                    <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setEditing(b)} title="Modifier">
                      <Pencil size={13} />
                    </button>
                    <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer « ${b.title} » de la bibliothèque ?`)) deleteBook(b.id); }} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge color="var(--accent-secondary)">{b.genre}</Badge>
                  <Badge color={reading ? 'var(--success)' : 'var(--text-secondary)'}>{reading ? 'En lecture' : 'Pas commencé'}</Badge>
                </div>

                {b.description && <p className="text-sm text-mute mb-3 line-clamp-2">{b.description}</p>}

                <div className="flex items-center justify-between text-xs text-mute mb-3">
                  <span>{b.pages.toLocaleString('fr-FR')} pages · {b.words.toLocaleString('fr-FR')} mots</span>
                  <span className="font-semibold" style={pop.style}>{b.popularity}/100 · {pop.label}</span>
                </div>

                <Button className="w-full" variant={reading ? 'secondary' : 'primary'} disabled={reading} onClick={() => addToReading(b.id)}>
                  {reading ? 'Déjà en lecture' : 'Ajouter à mes lectures'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Custom add form (needs a description textarea + skill picker alongside the fields) */}
      {modal && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-10 px-4" onClick={() => setModal(false)}>
          <div className="bg-card border border-line rounded-xl p-6 w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-5">Ajouter un livre à la bibliothèque</h2>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Titre"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
                <Field label="Auteur"><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
                <Field label="Genre">
                  <Select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
                    {GENRE_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((i) => <option key={i} value={i}>{i}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Année de parution"><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
                <Field label="Pages"><Input type="number" min="1" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} /></Field>
                <Field label="Mots (optionnel)" hint="~250 par page par défaut"><Input type="number" min="1" value={form.words} onChange={(e) => setForm({ ...form, words: e.target.value })} /></Field>
                <Field label="Popularité (/100)">
                  <input type="range" min="0" max="100" value={form.popularity} onChange={(e) => setForm({ ...form, popularity: Number(e.target.value) })} className="w-full mt-2" />
                </Field>
              </div>
              <Field label="Description">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Court résumé…" />
              </Field>
              <Field label="Compétences liées (optionnel — XP gagnée en lisant)">
                <SkillPicker value={form.linkedSkills} onChange={(ids) => setForm({ ...form, linkedSkills: ids })} />
              </Field>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
                <Button type="submit">Ajouter</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Modifier le livre"
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
