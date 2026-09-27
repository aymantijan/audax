import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, Square, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAllGoals } from '../../hooks/useAllGoals';
import { askAssistant, ASSISTANT_ERRORS } from '../../services/assistant';
import { buildAssistantContext, DEFAULT_SCOPES } from '../../utils/assistant-context';
import { Modal, Button } from '../common/ui';
import { splitAnswer, normalizeActions } from '../../utils/assistant-actions';
import { actionContext } from '../../services/assistant-actions';
import ActionCard from './ActionCard';

// Suggested questions, shown only when their section is shared.
const SUGGESTIONS = [
  { scope: 'today', text: 'Fais-moi le briefing du jour.' },
  { scope: 'etudes', text: 'Prépare mes révisions de la semaine.' },
  { scope: 'etudes', text: 'Fais-moi des fiches sur mon dernier cours.' },
  { scope: 'today', text: 'Propose-moi 3 ajustements pour la semaine prochaine.' },
  { scope: 'etudes', text: 'Que dois-je réviser ce soir ?' },
  { scope: 'today', text: 'Fais le bilan de ma semaine.' },
  { scope: 'patrimoine', text: 'Où part mon argent ce mois-ci ?' },
  { scope: 'sante', text: 'Comment mieux récupérer cette semaine ?' },
  { scope: 'carriere', text: 'Quelle est ma priorité côté carrière ?' },
];

// The assistant: one conversation for the whole app. The conversation lives
// only in this tab (nothing stored); durable facts are the ones the person
// writes in Paramètres → Assistant.
export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // question sent from elsewhere
  const [messages, setMessages] = useState([]); // kept while the tab lives
  useEffect(() => {
    const onOpen = (e) => { setOpen(true); if (e.detail?.question) setPending(e.detail.question); };
    window.addEventListener('vaudax:assistant', onOpen);
    return () => window.removeEventListener('vaudax:assistant', onOpen);
  }, []);
  if (!open) return null;
  return <AssistantDialog onClose={() => setOpen(false)} messages={messages} setMessages={setMessages} pending={pending} clearPending={() => setPending(null)} />;
}

// Mounted only while open, so the goals summary is computed only then.
function AssistantDialog({ onClose, messages, setMessages, pending, clearPending }) {
  const user = useAuthStore((s) => s.user);
  const goals = useAllGoals();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const scopes = user?.assistant?.scopes || DEFAULT_SCOPES;

  const send = async (question) => {
    const q = (question ?? draft).trim();
    if (!q || busy) return;
    setDraft('');
    const history = messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text: role === 'assistant' ? splitAnswer(text).text : text }));
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: '' }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const append = (delta) => setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + delta };
      return next;
    });
    try {
      const context = buildAssistantContext(scopes, { goals });
      const res = await askAssistant({ question: q, context, history, facts: user?.assistant?.facts || [] }, append, { signal: controller.signal });
      if (res.limit) setQuota({ used: res.used, limit: res.limit });
      // Actions the assistant prepared: checked against the person's data, shown as cards.
      const actions = normalizeActions(splitAnswer(res.text).actions, actionContext());
      if (actions.length) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { ...next[next.length - 1], actions, states: {} };
          return next;
        });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', text: ASSISTANT_ERRORS[e.code] || ASSISTANT_ERRORS.failed, error: true };
          return next;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // Guard: in development React runs effects twice; a question must be sent once.
  const sentRef = useRef(null);
  useEffect(() => {
    if (!pending) { sentRef.current = null; return; }
    if (sentRef.current === pending) return;
    sentRef.current = pending;
    clearPending();
    send(pending);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stop the answer when the window closes (not on React's development re-mount).
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; setTimeout(() => { if (!mountedRef.current) abortRef.current?.abort(); }, 0); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const suggestions = SUGGESTIONS.filter((s) => scopes.includes(s.scope)).slice(0, 4);

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> Assistant</span>} wide>
      <div className="flex flex-col gap-3">
        <div className="min-h-[200px] max-h-[55dvh] overflow-y-auto space-y-3 pr-1" aria-live="polite">
          {messages.length === 0 && (
            <div className="text-sm text-mute space-y-3">
              <p>Pose une question sur tes études, ta santé, ton argent ou ta carrière. Je m’appuie sur tes données. Je peux aussi te préparer des actions (révisions, fiches, relance, budget…) : rien n’est fait sans ton accord.</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s.text} type="button" onClick={() => send(s.text)} className="ui-btn rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-accent cursor-pointer">{s.text}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const shown = m.role === 'assistant' ? splitAnswer(m.text) : { text: m.text };
            return (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'space-y-2'}>
                <div className={`rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap max-w-[90%] ${m.role === 'user' ? 'bg-accent/15 text-ink' : m.error ? 'bg-bad/10 text-bad' : 'bg-surface border border-line'}`}>
                  {shown.text || (busy && i === messages.length - 1 ? '…' : '')}
                  {shown.pending && busy && i === messages.length - 1 && <span className="block text-xs text-mute mt-1">Je prépare les actions…</span>}
                </div>
                {m.actions?.length > 0 && (
                  <div className="space-y-2 max-w-[95%]">
                    <div className="text-[11px] text-mute">Préparé pour toi — rien n’est fait sans ton accord :</div>
                    {m.actions.map((a, k) => (
                      <ActionCard key={k} action={a} state={m.states?.[k]} onClose={onClose}
                        onChange={(st) => setMessages((ms) => ms.map((x, xi) => (xi === i ? { ...x, states: { ...x.states, [k]: st } } : x)))} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            maxLength={1200}
            placeholder="Ta question…"
            aria-label="Ta question"
            className="flex-1 resize-none bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
          />
          {busy ? (
            <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Arrêter"><Square size={16} /></Button>
          ) : (
            <Button type="submit" disabled={!draft.trim()} aria-label="Envoyer"><Send size={16} /></Button>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-mute">
          <span>
            Lit : {scopes.length ? scopes.length === DEFAULT_SCOPES.length ? 'toutes tes sections' : `${scopes.length} section${scopes.length > 1 ? 's' : ''}` : 'aucune section'} ·{' '}
            <Link to="/settings#assistant" onClick={onClose} className="text-accent hover:underline">régler</Link>
            {quota?.used != null && ` · ${quota.used}/${quota.limit} questions aujourd’hui`}
          </span>
          {messages.length > 0 && !busy && (
            <button type="button" onClick={() => setMessages([])} className="flex items-center gap-1 hover:text-ink cursor-pointer"><RotateCcw size={12} /> Nouvelle conversation</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
