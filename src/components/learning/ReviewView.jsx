import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain, Plus, Play, Layers, Pencil, Trash2, Upload, Search, RotateCcw, Flame, Target, Settings2, ArrowLeft, GraduationCap, Sparkles,
} from 'lucide-react';
import {
  useFlashcardStore, buildQueue, deckStats, retentionRate, reviewStreak, parseCardLines, newIntroducedToday,
} from '../../store/flashcardStore';
import { useLearningStore } from '../../store/learningStore';
import { fmtInterval } from '../../utils/fsrs';
import { isAcademic } from '../../utils/academic';
import { todayKey } from '../../utils/formatters';
import { Button, Card, Field, Input, Modal, Select, Textarea } from '../common/ui';
import { SectionHeader, BigStat, tint } from './design';
import { courseColor } from './TimetableView';
import ReviewSession from './ReviewSession';

const STATE_LABEL = { new: 'Nouvelle', learning: 'Apprentissage', relearning: 'Réapprentissage', review: 'Révision' };

// ── Modals ───────────────────────────────────────────────────────────────
export function DeckModal({ open, onClose, deck, onCreated }) {
  const { addDeck, editDeck, deleteDeck } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const [f, setF] = useState({ name: '', courseId: '', description: '' });
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (open) { setF(deck ? { ...deck, courseId: deck.courseId || '' } : { name: '', courseId: '', description: '' }); setConfirmDel(false); } }, [open, deck]);
  const active = courses.filter((c) => c.status === 'active');
  const save = (e) => {
    e.preventDefault();
    const courseName = active.find((c) => c.id === f.courseId)?.name;
    const name = f.name.trim() || courseName;
    if (!name) return;
    if (deck) editDeck(deck.id, { name, courseId: f.courseId || null, description: f.description });
    else onCreated?.(addDeck({ name, courseId: f.courseId || null, description: f.description }));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={deck ? 'Modifier le paquet' : 'Nouveau paquet de fiches'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Lié à une matière / un cours (optionnel)" hint="Les fiches pourront être rattachées à ses chapitres, et le temps de révision compte pour la matière.">
          <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
            <option value="">— Paquet indépendant (langue, concepts…) —</option>
            {active.filter(isAcademic).length > 0 && <optgroup label="Cursus">{active.filter(isAcademic).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {active.filter((c) => !isAcademic(c)).length > 0 && <optgroup label="Cours libres">{active.filter((c) => !isAcademic(c)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          </Select>
        </Field>
        <Field label="Nom du paquet"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Anglais — vocabulaire business" autoFocus /></Field>
        <Field label="Description (optionnel)"><Input value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex items-center gap-2 pt-1">
          {deck && (confirmDel ? (
            <span className="flex items-center gap-2 text-xs"><span className="text-bad">Supprimer le paquet et ses fiches ?</span>
              <Button type="button" variant="danger" onClick={() => { deleteDeck(deck.id); onClose(); }}>Oui</Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDel(false)}>Non</Button></span>
          ) : <Button type="button" variant="ghost" onClick={() => setConfirmDel(true)}>Supprimer</Button>)}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit">{deck ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function CardModal({ open, onClose, deckId, card }) {
  const { addCard, editCard, decks } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const deck = decks.find((d) => d.id === (card?.deckId || deckId));
  const chapters = courses.find((c) => c.id === deck?.courseId)?.chapters || [];
  const [f, setF] = useState({ front: '', back: '', chapterId: '', reverse: false });
  const [added, setAdded] = useState(0);
  useEffect(() => { if (open) { setF(card ? { front: card.front, back: card.back, chapterId: card.chapterId || '', reverse: false } : { front: '', back: '', chapterId: '', reverse: false }); setAdded(0); } }, [open, card]);

  const save = (keepOpen) => {
    if (!f.front.trim() || !f.back.trim()) return;
    if (card) { editCard(card.id, { front: f.front.trim(), back: f.back.trim(), chapterId: f.chapterId || null }); onClose(); return; }
    const n = addCard({ deckId, front: f.front, back: f.back, chapterId: f.chapterId || null, reverse: f.reverse });
    setAdded((a) => a + n);
    if (keepOpen) {
      setF((x) => ({ ...x, front: '', back: '' }));
      setTimeout(() => document.getElementById('card-front')?.focus(), 0);
    } else onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={card ? 'Modifier la fiche' : `Nouvelle fiche · ${deck?.name || ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); save(!card); }} className="space-y-3">
        <Field label="Recto — question, terme, notion"><Textarea id="card-front" rows={3} value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} autoFocus /></Field>
        <Field label="Verso — réponse, définition, traduction"><Textarea rows={4} value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} /></Field>
        {chapters.length > 0 && (
          <Field label="Chapitre (optionnel)">
            <Select value={f.chapterId} onChange={(e) => setF({ ...f, chapterId: e.target.value })} options={[{ value: '', label: '— Aucun —' }, ...chapters.map((ch) => ({ value: ch.id, label: ch.title }))]} />
          </Field>
        )}
        {!card && (
          <label className="flex items-center gap-2 text-sm text-mute cursor-pointer">
            <input type="checkbox" checked={f.reverse} onChange={(e) => setF({ ...f, reverse: e.target.checked })} className="accent-[var(--accent-primary)]" />
            Créer aussi la fiche inverse (verso → recto), utile pour les langues
          </label>
        )}
        <div className="flex items-center gap-2 pt-1">
          {added > 0 && <span className="text-xs text-good">{added} fiche(s) ajoutée(s)</span>}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{card ? 'Annuler' : 'Fermer'}</Button>
            {!card && <Button type="button" variant="secondary" onClick={() => save(false)}>Ajouter et fermer</Button>}
            <Button type="submit">{card ? 'Enregistrer' : 'Ajouter et continuer'}</Button>
          </div>
        </div>
        {!card && <p className="text-[11px] text-mute">Astuce : une fiche = une seule idée. Question courte, réponse courte.</p>}
      </form>
    </Modal>
  );
}

export function BulkCardsModal({ open, onClose, deckId }) {
  const { addCards, decks } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const deck = decks.find((d) => d.id === deckId);
  const chapters = courses.find((c) => c.id === deck?.courseId)?.chapters || [];
  const [text, setText] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [reverse, setReverse] = useState(false);
  const rows = useMemo(() => parseCardLines(text), [text]);
  useEffect(() => { if (open) { setText(''); setChapterId(''); setReverse(false); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={`Importer des fiches · ${deck?.name || ''}`} wide>
      <div className="space-y-3">
        <p className="text-sm text-mute">Une fiche par ligne : <code className="text-xs bg-surface border border-line rounded px-1.5 py-0.5">recto ; verso</code>. Les exports texte d'Anki et de Quizlet (séparés par tabulation) fonctionnent aussi.</p>
        <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Actif ; Ensemble des ressources contrôlées par l’entreprise\nBFR ; Besoin en fonds de roulement = actif circulant − passif circulant\nto leverage ; tirer parti de'} />
        <div className="grid sm:grid-cols-2 gap-3 items-end">
          {chapters.length > 0 ? (
            <Field label="Chapitre (optionnel)"><Select value={chapterId} onChange={(e) => setChapterId(e.target.value)} options={[{ value: '', label: '— Aucun —' }, ...chapters.map((ch) => ({ value: ch.id, label: ch.title }))]} /></Field>
          ) : <div />}
          <label className="flex items-center gap-2 text-sm text-mute cursor-pointer pb-2">
            <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} className="accent-[var(--accent-primary)]" /> Créer aussi les fiches inverses
          </label>
        </div>
        {rows.length > 0 && (
          <div className="rounded-lg border border-line max-h-56 overflow-y-auto divide-y divide-line/60">
            {rows.slice(0, 50).map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 px-3 py-1.5 text-sm"><span className="text-ink">{r.front}</span><span className="text-mute">{r.back}</span></div>
            ))}
            {rows.length > 50 && <div className="px-3 py-1.5 text-xs text-mute">… et {rows.length - 50} autre(s)</div>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={!rows.length} onClick={() => { addCards(deckId, rows, { chapterId: chapterId || null, reverse }); onClose(); }}>
            Importer {rows.length * (reverse ? 2 : 1) || ''} fiche(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Deck detail (card browser) ───────────────────────────────────────────
function DeckDetail({ deck, onBack, onReview }) {
  const { cards, deleteCard, resetCard } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const course = courses.find((c) => c.id === deck.courseId);
  const [q, setQ] = useState('');
  const [cardModal, setCardModal] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [deckModal, setDeckModal] = useState(false);
  const now = Date.now();
  const list = cards.filter((c) => c.deckId === deck.id && (!q || `${c.front} ${c.back}`.toLowerCase().includes(q.toLowerCase())));
  const st = deckStats(deck.id, cards);
  const chapterName = (id) => course?.chapters?.find((ch) => ch.id === id)?.title;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink cursor-pointer"><ArrowLeft size={14} /> Tous les paquets</button>
      <div className="rounded-2xl border border-line p-5" style={{ background: `linear-gradient(135deg, ${tint(deck.courseId ? courseColor(deck.courseId) : 'var(--accent-secondary)', 14)}, var(--bg-tertiary) 60%)` }}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink truncate">{deck.name}</h2>
              <button onClick={() => setDeckModal(true)} className="p-1 text-mute hover:text-accent cursor-pointer"><Pencil size={13} /></button>
            </div>
            <p className="text-xs text-mute mt-1">
              {course ? <Link to={`/learning/course/${course.id}`} className="hover:text-ink underline">{course.name}</Link> : 'Paquet indépendant'}
              {' · '}{st.total} fiche(s) · {st.due} à revoir · {st.fresh} nouvelle(s) · {st.mature} maîtrisée(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" onClick={() => setBulk(true)}><span className="flex items-center gap-1.5"><Upload size={14} /> Importer</span></Button>
            <Button variant="secondary" onClick={() => setCardModal({})}><span className="flex items-center gap-1.5"><Plus size={14} /> Fiche</span></Button>
            <Button disabled={!st.due && !st.fresh} onClick={() => onReview([deck.id], deck.name)}><span className="flex items-center gap-1.5"><Play size={14} /> Réviser</span></Button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une fiche…"
          className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent" />
      </div>

      {list.length ? (
        <div className="rounded-xl border border-line bg-card divide-y divide-line/60">
          {list.map((c) => (
            <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1 px-4 py-3 items-start">
              <div className="text-sm text-ink whitespace-pre-wrap break-words">{c.front}</div>
              <div className="text-sm text-mute whitespace-pre-wrap break-words">{c.back}</div>
              <div className="flex items-center gap-2 md:justify-end text-[11px] text-mute whitespace-nowrap">
                {chapterName(c.chapterId) && <span className="truncate max-w-[8rem]">{chapterName(c.chapterId)}</span>}
                <span className="rounded-full px-1.5 py-0.5 border border-line">{STATE_LABEL[c.state]}</span>
                {c.state !== 'new' && <span>{c.due <= now ? 'à revoir' : `dans ${fmtInterval(c.due - now)}`}</span>}
                <button className="p-1 hover:text-accent cursor-pointer" title="Modifier" onClick={() => setCardModal({ card: c })}><Pencil size={12} /></button>
                <button className="p-1 hover:text-accent cursor-pointer" title="Réapprendre depuis zéro" onClick={() => resetCard(c.id)}><RotateCcw size={12} /></button>
                <button className="p-1 hover:text-bad cursor-pointer" title="Supprimer" onClick={() => deleteCard(c.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card><p className="text-sm text-mute text-center py-4">{q ? 'Aucune fiche ne correspond.' : 'Paquet vide : ajoutez vos premières fiches ou importez une liste.'}</p></Card>
      )}

      <CardModal open={!!cardModal} onClose={() => setCardModal(null)} deckId={deck.id} card={cardModal?.card} />
      <BulkCardsModal open={bulk} onClose={() => setBulk(false)} deckId={deck.id} />
      <DeckModal open={deckModal} onClose={() => setDeckModal(false)} deck={deck} />
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────
export default function ReviewView() {
  const { decks, cards, reviewLog, settings, updateSettings } = useFlashcardStore();
  const courses = useLearningStore((s) => s.courses);
  const [openDeck, setOpenDeck] = useState(null);
  const [session, setSession] = useState(null); // { deckIds, title }
  const [deckModal, setDeckModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const queueAll = useMemo(() => buildQueue({ cards, decks, reviewLog, settings }), [cards, decks, reviewLog, settings]);
  const dueCount = queueAll.filter((c) => c.state !== 'new').length;
  const newCount = queueAll.length - dueCount;
  const retention = retentionRate(reviewLog);
  const streak = reviewStreak(reviewLog);
  const todayStr = todayKey();
  const doneToday = reviewLog.filter((e) => e.d === todayStr).length;
  const deck = decks.find((d) => d.id === openDeck);

  const sessionEl = session && <ReviewSession deckIds={session.deckIds} title={session.title} onClose={() => setSession(null)} />;

  if (deck) {
    return <>{<DeckDetail deck={deck} onBack={() => setOpenDeck(null)} onReview={(deckIds, title) => setSession({ deckIds, title })} />}{sessionEl}</>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${tint('var(--accent-secondary)', 12)}, var(--bg-tertiary) 60%)` }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint('var(--accent-secondary)', 20) }}>
              <Brain size={24} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">{queueAll.length ? `${queueAll.length} fiche(s) à réviser` : 'Tout est à jour'}</h2>
              <p className="text-sm text-mute">{dueCount} à revoir · {newCount} nouvelle(s) aujourd'hui · {doneToday} révision(s) faite(s)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(true)} title="Réglages"><Settings2 size={15} /></Button>
            <Button disabled={!queueAll.length} onClick={() => setSession({ deckIds: null, title: 'Révision — tous les paquets' })}>
              <span className="flex items-center gap-2"><Play size={15} /> Réviser tout</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <BigStat label="Fiches" value={cards.length} sub={`${decks.length} paquet(s)`} />
          <BigStat label="Maîtrisées" value={cards.filter((c) => c.state === 'review' && (c.stability || 0) >= 21).length} sub="intervalle ≥ 3 semaines" color="var(--success)" />
          <BigStat label="Réussite (30 j)" value={retention == null ? '—' : `${retention}%`} sub="révisions sans « À revoir »" color={retention == null ? undefined : retention >= 85 ? 'var(--success)' : retention >= 70 ? 'var(--warning)' : 'var(--error)'} />
          <BigStat label="Série" value={<span className="flex items-center gap-1"><Flame size={18} />{streak} j</span>} sub="jours de révision d'affilée" color={streak ? 'var(--warning)' : undefined} />
        </div>
      </div>

      <SectionHeader icon={Layers} title="Paquets" subtitle="Un paquet par matière, ou des paquets libres (langues, concepts de trading…)."
        action={<Button variant="secondary" className="!py-1.5" onClick={() => setDeckModal(true)}><span className="flex items-center gap-1"><Plus size={13} /> Paquet</span></Button>} />

      {decks.length ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {decks.map((d) => {
            const st = deckStats(d.id, cards);
            const course = courses.find((c) => c.id === d.courseId);
            const color = d.courseId ? courseColor(d.courseId) : 'var(--accent-secondary)';
            const pending = buildQueue({ cards, decks, deckIds: [d.id], reviewLog, settings }).length;
            return (
              <div key={d.id} className="rounded-xl border border-line bg-card p-4 flex flex-col gap-3 hover:border-accent/60 transition-colors" style={{ borderTop: `3px solid ${color}` }}>
                <button onClick={() => setOpenDeck(d.id)} className="text-left cursor-pointer min-w-0">
                  <div className="font-semibold text-ink truncate hover:text-accent">{d.name}</div>
                  <div className="text-[11px] text-mute mt-0.5 flex items-center gap-1">
                    {course ? <><GraduationCap size={11} /> {course.name}</> : <><Sparkles size={11} /> Paquet indépendant</>}
                  </div>
                </button>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['À revoir', st.due, 'var(--warning)'], ['Nouvelles', st.fresh, 'var(--accent-primary)'], ['Total', st.total, 'var(--text-secondary)']].map(([l, v, c]) => (
                    <div key={l} className="rounded-lg bg-surface py-1.5">
                      <div className="text-base font-bold tabular-nums" style={{ color: v ? c : 'var(--text-secondary)' }}>{v}</div>
                      <div className="text-[10px] text-mute">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button variant="secondary" className="!py-1.5 text-xs flex-1" onClick={() => setOpenDeck(d.id)}>Fiches</Button>
                  <Button className="!py-1.5 text-xs flex-1" disabled={!pending} onClick={() => setSession({ deckIds: [d.id], title: d.name })}>
                    <span className="flex items-center justify-center gap-1"><Play size={12} /> {pending ? `Réviser (${pending})` : 'À jour'}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="text-center py-6 max-w-lg mx-auto">
            <Brain size={28} className="mx-auto text-mute mb-2" />
            <p className="text-sm font-medium text-ink">Mémorisez pour de bon avec la répétition espacée</p>
            <p className="text-xs text-mute mt-1">Chaque fiche revient juste avant que vous ne l'oubliiez : quelques minutes par jour suffisent pour retenir définitions, formules, vocabulaire ou règles de trading.</p>
            <Button className="mt-4" onClick={() => setDeckModal(true)}>Créer mon premier paquet</Button>
          </div>
        </Card>
      )}

      <DeckModal open={deckModal} onClose={() => setDeckModal(false)} onCreated={(id) => setOpenDeck(id)} />
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Réglages des révisions">
        <div className="space-y-4">
          <Field label="Nouvelles fiches par jour" hint={`Déjà introduites aujourd'hui : ${newIntroducedToday(reviewLog)}. Plus c'est haut, plus les révisions des jours suivants seront nombreuses.`}>
            <Input type="number" min="0" max="200" value={settings.newPerDay} onChange={(e) => updateSettings({ newPerDay: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="Taux de rétention visé" hint="90 % est l'équilibre recommandé. Plus haut = révisions plus fréquentes.">
            <Select value={settings.retention} onChange={(e) => updateSettings({ retention: Number(e.target.value) })}
              options={[0.8, 0.85, 0.9, 0.93, 0.95].map((v) => ({ value: v, label: `${Math.round(v * 100)} %` }))} />
          </Field>
          <div className="flex items-start gap-2 text-[11px] text-mute"><Target size={12} className="mt-0.5 shrink-0" /> Algorithme FSRS (celui d'Anki) : l'intervalle s'adapte à chaque fiche selon vos réponses.</div>
          <div className="flex justify-end"><Button onClick={() => setSettingsOpen(false)}>Fermer</Button></div>
        </div>
      </Modal>
      {sessionEl}
    </div>
  );
}
