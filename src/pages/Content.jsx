import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus, Trash2, Pencil, ExternalLink, Target, TrendingUp, BookOpen } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { useContentStore, detectPlatformFromUrl } from '../store/contentStore';
import { useLearningStore } from '../store/learningStore';
import { CONTENT_PLATFORMS, CONTENT_STATUSES, LIFE_DOMAINS } from '../utils/constants';
import { fmtDateShort, todayKey } from '../utils/formatters';
import { Card, Stat, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, ProgressBar } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import BadgeList from '../components/common/BadgeList';

const tooltipStyle = { contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };
const PLATFORM_COLOR = { LinkedIn: '#0a66c2', Blog: '#66ccff', Portfolio: '#b366ff', 'X/Twitter': '#e2e8f0', YouTube: '#ff4444', Newsletter: 'var(--success)', Autre: 'var(--text-secondary)' };
const STATUS_COLOR = { 'Idée': 'var(--text-secondary)', Brouillon: 'var(--warning)', Planifié: 'var(--accent-secondary)', Publié: 'var(--success)' };

const blank = () => ({ platform: 'LinkedIn', title: '', url: '', status: 'Publié', publishedDate: todayKey(), domain: 'General', courseId: '', likes: '', comments: '', shares: '', views: '', notes: '' });
// courseId's options depend on the live courses list, so this is a function
// of courses rather than a static array (same pattern Career.jsx's
// appFields(contacts) already established for a store-dependent select).
const postFields = (courses) => [
  { name: 'title', label: 'Titre', type: 'text' },
  { name: 'platform', label: 'Plateforme', type: 'select', options: CONTENT_PLATFORMS },
  { name: 'status', label: 'Statut', type: 'select', options: CONTENT_STATUSES },
  { name: 'domain', label: 'Domaine', type: 'select', options: LIFE_DOMAINS },
  { name: 'publishedDate', label: 'Date de publication', type: 'date', hint: "Laisser vide tant que ce n'est pas encore publié." },
  { name: 'url', label: 'Lien', type: 'text' },
  { name: 'courseId', label: 'Dérivé du cours (Learning)', type: 'select', options: [{ value: '', label: '— Aucun —' }, ...courses.map((c) => ({ value: c.id, label: c.name }))] },
  { name: 'likes', label: 'Likes', type: 'number' },
  { name: 'comments', label: 'Commentaires', type: 'number' },
  { name: 'shares', label: 'Partages', type: 'number' },
  { name: 'views', label: 'Vues', type: 'number' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Content() {
  const { posts, addPost, editPost, deletePost, getTotalEngagement, getBadges, getGoalProgress, setMonthlyGoal, getBestPerformers } = useContentStore();
  const courses = useLearningStore((s) => s.courses);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailAuto, setDetailAuto] = useState(false); // true once the user has manually picked a platform, so URL auto-detect stops overriding them
  const [form, setForm] = useState(blank());
  const [goalInput, setGoalInput] = useState(() => useContentStore.getState().monthlyGoal || '');

  const published = posts.filter((p) => p.status === 'Publié');
  const totalEngagement = published.reduce((a, p) => a + getTotalEngagement(p), 0);
  const last30 = published.filter((p) => p.publishedDate >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length;
  const byPlatform = useMemo(
    () => CONTENT_PLATFORMS.map((pl) => ({ name: pl, count: published.filter((p) => p.platform === pl).length })).filter((p) => p.count > 0),
    [published]
  );
  const engagementTrend = useMemo(
    () => [...published].sort((a, b) => (a.publishedDate < b.publishedDate ? -1 : 1)).map((p) => ({ date: p.publishedDate.slice(5), engagement: getTotalEngagement(p), title: p.title })),
    [published]
  );
  const goal = getGoalProgress();
  const performers = useMemo(() => getBestPerformers(), [posts]);
  const courseName = (id) => courses.find((c) => c.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    const res = addPost(form);
    if (!res.ok) return alert(res.error);
    setModal(false);
    setForm(blank());
    setDetailAuto(false);
  };
  const onUrlChange = (url) => {
    const detected = !detailAuto && detectPlatformFromUrl(url);
    setForm((f) => ({ ...f, url, ...(detected ? { platform: detected } : {}) }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-mute text-sm mt-1">Publications et engagement — transformer le travail en visibilité.</p>
        </div>
        <Button onClick={() => setModal(true)}><span className="flex items-center gap-2"><Plus size={16} /> Nouvelle publication</span></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Publications" value={published.length} sub={posts.length > published.length ? `+${posts.length - published.length} en pipeline` : undefined} />
        <Stat label="30 derniers jours" value={last30} />
        <Stat label="Engagement total" value={totalEngagement} />
        <Stat label="Plateformes" value={byPlatform.length} sub={`sur ${CONTENT_PLATFORMS.length}`} />
      </div>

      <Card title="Objectif mensuel">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Target size={16} className="text-mute" />
            <Input
              type="number"
              className="!w-20"
              placeholder="0"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={() => { if (goalInput !== '') setMonthlyGoal(goalInput); }}
            />
            <span className="text-xs text-mute">posts / mois</span>
          </div>
          {goal.pct != null ? (
            <div className="flex-1">
              <div className="flex justify-between text-xs text-mute mb-1"><span>{goal.count} / {goal.goal} ce mois-ci</span><span>{goal.pct}%</span></div>
              <ProgressBar value={goal.pct} color={goal.pct >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
            </div>
          ) : (
            <span className="text-xs text-mute">Fixe une cible pour suivre ta progression du mois.</span>
          )}
        </div>
      </Card>

      {(performers.byPlatform.length > 0 || performers.byDomain.length > 0) && (
        <Card title="Meilleure performance">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {performers.byPlatform.length > 0 && (
              <div>
                <div className="text-xs text-mute uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><TrendingUp size={12} /> Par plateforme</div>
                <ul className="space-y-1">
                  {performers.byPlatform.map((p) => (
                    <li key={p.name} className="flex justify-between"><Badge color={PLATFORM_COLOR[p.name]}>{p.name}</Badge><span className="text-mute">{p.avg} engagement moy. · {p.count} post{p.count > 1 ? 's' : ''}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {performers.byDomain.length > 0 && (
              <div>
                <div className="text-xs text-mute uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><TrendingUp size={12} /> Par domaine</div>
                <ul className="space-y-1">
                  {performers.byDomain.map((p) => (
                    <li key={p.name} className="flex justify-between"><Badge>{p.name}</Badge><span className="text-mute">{p.avg} engagement moy. · {p.count} post{p.count > 1 ? 's' : ''}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {engagementTrend.length > 1 && (
          <Card title="Engagement dans le temps">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={engagementTrend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} formatter={(v, n, p) => [v, p.payload.title]} />
                <Line type="monotone" dataKey="engagement" stroke="#0a66c2" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
        {byPlatform.length > 1 && (
          <Card title="Publications par plateforme">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byPlatform}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byPlatform.map((p) => <Cell key={p.name} fill={PLATFORM_COLOR[p.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <Card title={`Publications (${posts.length})`}>
        {posts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-line">
                  <th className="py-2 pr-4">Titre</th>
                  <th className="py-2 pr-4">Plateforme</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4 text-right">Engagement</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 hover:bg-surface/50">
                    <td className="py-2.5 pr-4">
                      {p.title}
                      {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-mute hover:text-accent ml-1.5 inline-block"><ExternalLink size={11} /></a>}
                      {p.courseId && courseName(p.courseId) && (
                        <Link to={`/learning/course/${p.courseId}`} className="flex items-center gap-1 text-[11px] text-accent hover:underline mt-0.5">
                          <BookOpen size={10} /> {courseName(p.courseId)}
                        </Link>
                      )}
                    </td>
                    <td className="py-2.5 pr-4"><Badge color={PLATFORM_COLOR[p.platform]}>{p.platform}</Badge></td>
                    <td className="py-2.5 pr-4"><Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
                    <td className="py-2.5 pr-4 text-mute">{p.publishedDate ? fmtDateShort(p.publishedDate) : '—'}</td>
                    <td className="py-2.5 pr-4 text-right">{getTotalEngagement(p)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button className="text-mute hover:text-accent mr-3 cursor-pointer" onClick={() => setEditing(p)}><Pencil size={14} /></button>
                      <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm(`Supprimer "${p.title}" ?`)) deletePost(p.id); }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState><Megaphone className="mx-auto mb-2 text-mute" size={26} />Aucune publication pour l'instant.</EmptyState>
        )}
      </Card>

      <BadgeList badges={getBadges()} />

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle publication">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Titre"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Statut"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={CONTENT_STATUSES} /></Field>
            <Field label="Plateforme"><Select value={form.platform} onChange={(e) => { setDetailAuto(true); setForm({ ...form, platform: e.target.value }); }} options={CONTENT_PLATFORMS} /></Field>
            <Field label="Domaine"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} options={LIFE_DOMAINS} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.status === 'Publié' ? 'Date de publication' : 'Date prévue (optionnel)'}><Input type="date" value={form.publishedDate} onChange={(e) => setForm({ ...form, publishedDate: e.target.value })} /></Field>
            <Field label="Dérivé du cours (optionnel)"><Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} options={[{ value: '', label: '— Aucun —' }, ...courses.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          </div>
          <Field label="Lien (optionnel)" hint="La plateforme se détecte automatiquement pour LinkedIn, YouTube, X, Substack, Medium.">
            <Input value={form.url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://linkedin.com/posts/…" />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Likes"><Input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} /></Field>
            <Field label="Commentaires"><Input type="number" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></Field>
            <Field label="Partages"><Input type="number" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} /></Field>
            <Field label="Vues"><Input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      {editing && (
        <EntityFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Éditer la publication"
          fields={postFields(courses)}
          initial={editing}
          wide
          onSave={(values) => editPost(editing.id, values)}
          onDelete={() => deletePost(editing.id)}
        />
      )}
    </div>
  );
}
