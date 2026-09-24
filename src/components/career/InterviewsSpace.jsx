import { useMemo, useState } from 'react';
import { CalendarClock, Shuffle, Eye, CheckCircle2, Plus, Trash2, Pencil, BookMarked, Scale, Layers, ChevronDown } from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { QUESTION_CATEGORIES } from '../../utils/constants';
import { fmtDate, todayKey } from '../../utils/formatters';
import { toast } from '../../store/uiStore';
import { Card, Button, Field, Input, Select, Textarea, Modal, EmptyState } from '../common/ui';

const DECK = 'Entretiens';
const CRITERIA = [['salary', 'Rémunération'], ['learning', 'Apprentissage'], ['career', 'Perspectives'], ['culture', 'Culture']];

/** Weighted offer scores (0–10). Salary is scored against the best offer (annual: monthly × 12 + bonus). */
export function offerScores(apps, weights) {
  const withOffer = apps.filter((a) => a.offer);
  const annual = (o) => (Number(o.salary) || 0) * 12 + (Number(o.bonus) || 0);
  const best = Math.max(0, ...withOffer.map((a) => annual(a.offer)));
  return withOffer.map((a) => {
    const o = a.offer;
    const parts = { salary: best ? (annual(o) / best) * 5 : null, learning: o.learning, career: o.career, culture: o.culture };
    let sum = 0; let wsum = 0;
    for (const [k] of CRITERIA) if (parts[k] != null && (Number(weights?.[k]) || 0) > 0) { sum += parts[k] * Number(weights[k]); wsum += Number(weights[k]); }
    return { app: a, annual: annual(o), parts, score: wsum ? Math.round((sum / wsum) * 2 * 10) / 10 : null };
  }).sort((x, y) => (y.score ?? -1) - (x.score ?? -1));
}

function StoryModal({ story, onClose }) {
  const { addStory, editStory } = useCareerStore();
  const [f, setF] = useState({ title: '', situation: '', task: '', action: '', result: '', tags: '', ...(story || {}), ...(story ? { tags: (story.tags || []).join(', ') } : {}) });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={story ? 'Modifier l’histoire' : 'Nouvelle histoire STAR'} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!f.title.trim()) return;
        const data = { ...f, title: f.title.trim(), tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) };
        if (story) editStory(story.id, data); else addStory(data);
        onClose();
      }}>
        <Field label="Titre (pour la retrouver)"><Input value={f.title} onChange={set('title')} placeholder="ex. Relancer un projet d’association en retard" autoFocus /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="S — Situation"><Textarea rows={3} value={f.situation} onChange={set('situation')} placeholder="Le contexte, en 2 phrases." /></Field>
          <Field label="T — Tâche"><Textarea rows={3} value={f.task} onChange={set('task')} placeholder="Ce qu’on attendait de vous." /></Field>
          <Field label="A — Action"><Textarea rows={3} value={f.action} onChange={set('action')} placeholder="Ce que VOUS avez fait (« je », pas « nous »)." /></Field>
          <Field label="R — Résultat"><Textarea rows={3} value={f.result} onChange={set('result')} placeholder="Chiffré si possible, et ce que vous en avez appris." /></Field>
        </div>
        <Field label="Qualités illustrées (séparées par des virgules)"><Input value={f.tags} onChange={set('tags')} placeholder="leadership, gestion du stress, rigueur" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function InterviewsSpace({ onOpenApp }) {
  const { applications, questions, stories, practiceQuestion, editQuestion, addQuestion, deleteQuestion, deleteStory, offerWeights, setOfferWeights } = useCareerStore();
  const today = todayKey();
  const [cat, setCat] = useState('all');
  const [current, setCurrent] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [openQ, setOpenQ] = useState(null);
  const [newQ, setNewQ] = useState({ category: QUESTION_CATEGORIES[0], question: '' });
  const [storyForm, setStoryForm] = useState(null);

  const upcoming = useMemo(() => applications.flatMap((a) => (a.interviews || []).filter((i) => i.date >= today).map((i) => ({ ...i, app: a }))).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [applications, today]);
  const pool = (questions || []).filter((q) => cat === 'all' || q.category === cat);
  const draw = () => {
    if (!pool.length) return;
    // Least-practised first, random among ties.
    const min = Math.min(...pool.map((q) => q.practiced || 0));
    const cands = pool.filter((q) => (q.practiced || 0) === min && q.id !== current);
    const pick = (cands.length ? cands : pool)[Math.floor(Math.random() * (cands.length || pool.length))];
    setCurrent(pick.id); setReveal(false);
  };
  const q = (questions || []).find((x) => x.id === current);
  const toFlashcards = () => {
    const fc = useFlashcardStore.getState();
    const deckId = fc.decks.find((d) => d.name === DECK)?.id || fc.addDeck({ name: DECK, description: 'Questions d’entretien et mes réponses clés' });
    const existing = new Set(fc.cards.filter((c) => c.deckId === deckId).map((c) => c.front));
    const toAdd = (questions || []).filter((x) => x.answer?.trim() && !existing.has(x.question));
    for (const x of toAdd) fc.addCard({ deckId, front: x.question, back: x.answer.trim() });
    toast(toAdd.length ? `${toAdd.length} question(s) ajoutée(s) aux Révisions (paquet « ${DECK} »)` : 'Rien de nouveau : écrivez d’abord vos réponses clés', toAdd.length ? 'success' : 'info');
  };
  const offers = useMemo(() => offerScores(applications, offerWeights), [applications, offerWeights]);
  const currencies = [...new Set(offers.map((o) => o.app.offer.currency || 'MAD'))];

  return (
    <div className="space-y-5">
      <Card title={`Entretiens à venir (${upcoming.length})`}>
        {upcoming.length ? (
          <ul className="divide-y divide-line/60">
            {upcoming.map((i) => (
              <li key={i.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                <CalendarClock size={15} className="text-accent" />
                <span className="font-medium">{i.app.company}</span>
                <span className="text-mute">{i.app.role} · {i.kind}{i.with ? ` · ${i.with}` : ''}</span>
                <span className="flex-1" />
                <span className="text-xs text-mute">{i.date === today ? 'aujourd’hui' : fmtDate(i.date)}{i.time ? ` · ${i.time}` : ''}</span>
                <Button variant="secondary" className="!py-1 !px-2 text-xs" onClick={() => onOpenApp(i.app.id, 'prep')}>Préparer</Button>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Aucun entretien prévu. Ajoutez-les depuis la fiche d’une candidature (onglet Entretiens).</EmptyState>}
      </Card>

      <Card title="S’entraîner" action={<button onClick={toFlashcards} className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1"><Layers size={12} /> Envoyer vers Révisions</button>}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select value={cat} onChange={(e) => { setCat(e.target.value); setCurrent(null); }} options={[{ value: 'all', label: 'Toutes les catégories' }, ...QUESTION_CATEGORIES.map((c) => ({ value: c, label: c }))]} className="w-56" />
          <Button onClick={draw}><span className="flex items-center gap-1.5"><Shuffle size={14} /> {q ? 'Question suivante' : 'Tirer une question'}</span></Button>
        </div>
        {q ? (
          <div className="rounded-xl border border-line p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-mute">{q.category} · pratiquée {q.practiced || 0} fois</div>
            <div className="text-lg font-semibold">{q.question}</div>
            <p className="text-xs text-mute">Répondez à voix haute (idéalement chronométré : 1–2 min), puis comparez avec vos notes.</p>
            {reveal
              ? <div className="text-sm whitespace-pre-line rounded-lg bg-surface border border-line p-3">{q.answer || <span className="text-mute">Pas encore de notes — ajoutez vos points clés dans la banque ci-dessous.</span>}</div>
              : <Button variant="secondary" onClick={() => setReveal(true)}><span className="flex items-center gap-1.5"><Eye size={14} /> Voir mes notes</span></Button>}
            <Button onClick={() => { practiceQuestion(q.id); toast('Pratiquée ✓', 'success'); draw(); }}><span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Pratiquée</span></Button>
          </div>
        ) : <p className="text-sm text-mute">Les questions les moins travaillées sortent en premier.</p>}
      </Card>

      <Card title={`Banque de questions (${(questions || []).length})`}>
        <div className="space-y-4">
          {QUESTION_CATEGORIES.map((c) => {
            const list = (questions || []).filter((x) => x.category === c);
            if (!list.length) return null;
            return (
              <div key={c}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-mute mb-1.5">{c}</div>
                <ul className="space-y-1">
                  {list.map((x) => (
                    <li key={x.id} className="rounded-lg border border-line">
                      <div className="flex items-center gap-2 px-3 py-2 text-sm">
                        <button className="flex-1 text-left cursor-pointer flex items-center gap-2" onClick={() => setOpenQ(openQ === x.id ? null : x.id)}>
                          <ChevronDown size={13} className={`text-mute shrink-0 ${openQ === x.id ? '' : '-rotate-90'}`} />
                          <span>{x.question}</span>
                        </button>
                        {x.answer?.trim() ? <span className="text-[10px] text-good">notes ✓</span> : <span className="text-[10px] text-mute">sans notes</span>}
                        <span className="text-[10px] text-mute w-10 text-right">{x.practiced || 0}×</span>
                        <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette question ?')) deleteQuestion(x.id); }}><Trash2 size={12} /></button>
                      </div>
                      {openQ === x.id && (
                        <div className="px-3 pb-3">
                          <Textarea rows={4} value={x.answer || ''} onChange={(e) => editQuestion(x.id, { answer: e.target.value })} placeholder="Vos points clés (pas un texte à réciter) : structure, exemples, chiffres." />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!newQ.question.trim()) return; addQuestion(newQ); setNewQ((p) => ({ ...p, question: '' })); }}>
            <Select value={newQ.category} onChange={(e) => setNewQ((p) => ({ ...p, category: e.target.value }))} options={QUESTION_CATEGORIES} className="w-52" />
            <Input value={newQ.question} onChange={(e) => setNewQ((p) => ({ ...p, question: e.target.value }))} placeholder="Ajouter une question (ex. entendue en entretien)" className="flex-1 min-w-[12rem]" />
            <Button type="submit" variant="secondary"><Plus size={14} /></Button>
          </form>
        </div>
      </Card>

      <Card title={`Histoires STAR (${(stories || []).length})`} action={<button onClick={() => setStoryForm('new')} className="text-xs text-accent hover:underline cursor-pointer flex items-center gap-1"><Plus size={12} /> Nouvelle</button>}>
        {(stories || []).length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {stories.map((s) => (
              <div key={s.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex items-start gap-2">
                  <BookMarked size={14} className="text-accent mt-0.5" />
                  <div className="font-medium flex-1">{s.title}</div>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setStoryForm(s)}><Pencil size={12} /></button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Supprimer cette histoire ?')) deleteStory(s.id); }}><Trash2 size={12} /></button>
                </div>
                {s.result && <div className="text-xs text-mute mt-1 line-clamp-2"><b>Résultat :</b> {s.result}</div>}
                {(s.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{s.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full border border-line text-mute">{t}</span>)}</div>}
              </div>
            ))}
          </div>
        ) : <EmptyState>4 à 6 histoires bien préparées couvrent la plupart des questions comportementales : un succès, un échec, un conflit, du leadership, de la pression.</EmptyState>}
      </Card>

      <Card title="Comparer les offres">
        {offers.length ? (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-mute">
              <Scale size={13} /> Importance :
              {CRITERIA.map(([k, l]) => (
                <label key={k} className="flex items-center gap-1">{l}
                  <select value={offerWeights?.[k] ?? 0} onChange={(e) => setOfferWeights({ [k]: Number(e.target.value) })} className="bg-surface border border-line rounded px-1 py-0.5 text-ink">
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-mute border-b border-line">
                    <th className="py-2 pr-3">Offre</th><th className="py-2 pr-3 text-right">Par an</th><th className="py-2 pr-3 text-center">Apprentissage</th>
                    <th className="py-2 pr-3 text-center">Perspectives</th><th className="py-2 pr-3 text-center">Culture</th><th className="py-2 pr-3">Réponse avant</th><th className="py-2 text-right">Score /10</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o, i) => (
                    <tr key={o.app.id} className={`border-b border-line/50 cursor-pointer hover:bg-surface/50 ${i === 0 && o.score != null ? 'bg-accent/5' : ''}`} onClick={() => onOpenApp(o.app.id, 'offre')}>
                      <td className="py-2 pr-3"><div className="font-medium">{o.app.company}</div><div className="text-[11px] text-mute">{o.app.role}{o.app.offer.location ? ` · ${o.app.offer.location}` : ''}</div></td>
                      <td className="py-2 pr-3 text-right tabular-nums">{o.annual ? `${o.annual.toLocaleString('fr-FR')} ${o.app.offer.currency || ''}` : '—'}</td>
                      <td className="py-2 pr-3 text-center">{o.parts.learning ? `${o.parts.learning}/5` : '—'}</td>
                      <td className="py-2 pr-3 text-center">{o.parts.career ? `${o.parts.career}/5` : '—'}</td>
                      <td className="py-2 pr-3 text-center">{o.parts.culture ? `${o.parts.culture}/5` : '—'}</td>
                      <td className="py-2 pr-3 text-xs">{o.app.offer.deadline ? <span className={o.app.offer.deadline < today ? 'text-bad' : ''}>{fmtDate(o.app.offer.deadline)}</span> : '—'}</td>
                      <td className="py-2 text-right font-bold tabular-nums" style={{ color: i === 0 && o.score != null ? 'var(--success)' : undefined }}>{o.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {currencies.length > 1 && <p className="text-[11px] text-warn mt-2">Devises différentes ({currencies.join(', ')}) : la rémunération est comparée sans conversion.</p>}
            <p className="text-[11px] text-mute mt-2">La rémunération est notée par rapport à la meilleure offre ; le reste vient de vos notes (étoiles) dans chaque offre. C’est une aide à la décision, pas la décision.</p>
          </>
        ) : <EmptyState>Quand vous recevez une offre, remplissez l’onglet « Offre » de la candidature : elles se comparent ici.</EmptyState>}
      </Card>

      {storyForm && <StoryModal story={storyForm === 'new' ? null : storyForm} onClose={() => setStoryForm(null)} />}
    </div>
  );
}
