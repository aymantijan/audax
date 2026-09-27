import { useState } from 'react';
import { KeyRound, Check, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { useAiKeyStore, AI_PROVIDERS, currentOwnerId } from '../../store/aiKeyStore';
import { testAiKey, ASSISTANT_ERRORS } from '../../services/assistant';
import { Button, Field, Input } from '../common/ui';
import { toast } from '../../store/uiStore';

const masked = (k) => (k ? `••••${k.slice(-4)}` : '');

// Bring your own AI key: Gemini, Claude, ChatGPT or OpenRouter. The key stays
// on this device, filed under the signed-in account.
export default function AiKeysSection() {
  const byOwner = useAiKeyStore((s) => s.byOwner);
  const setKey = useAiKeyStore((s) => s.setKey);
  const removeKey = useAiKeyStore((s) => s.removeKey);
  const setActive = useAiKeyStore((s) => s.setActive);
  const mine = byOwner[currentOwnerId()] || { active: null, keys: {} };
  const [provider, setProvider] = useState(mine.active || 'gemini');
  const saved = mine.keys[provider];
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(saved?.model || '');
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }
  const meta = AI_PROVIDERS.find((p) => p.key === provider);

  const pick = (p) => { setProvider(p); setDraft(''); setModel(mine.keys[p]?.model || ''); setResult(null); };
  const run = async () => {
    const key = draft.trim() || saved?.key;
    if (!key) { setResult({ ok: false, text: 'Colle d’abord ta clé.' }); return; }
    setTesting(true);
    setResult(null);
    const r = await testAiKey(provider, key, model);
    setTesting(false);
    if (r.ok) {
      setResult({ ok: true, text: 'La clé fonctionne.' });
      setKey(provider, key, model);
      setDraft('');
      toast(`Clé ${meta.label} enregistrée sur cet appareil.`, 'success');
    } else if (['offline', 'auth', 'not_configured'].includes(r.code)) {
      // Cannot be checked right now (offline, not signed in…): keep it anyway.
      setKey(provider, key, model);
      setDraft('');
      setResult({ ok: false, text: `Clé enregistrée, mais pas encore vérifiée : ${ASSISTANT_ERRORS[r.code] || ''}` });
    } else {
      setResult({ ok: false, text: ASSISTANT_ERRORS[r.code] || ASSISTANT_ERRORS.failed });
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
      <div className="flex items-start gap-2.5">
        <KeyRound size={16} className="text-accent mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold">Ta clé d’IA</div>
          <p className="text-mute text-xs mt-0.5">
            Utilise ton propre compte d’IA : pas de limite VAUDAX, et c’est ton fournisseur qui fixe ses conditions (gratuites ou payantes).
            La clé reste uniquement sur cet appareil : elle n’est ni synchronisée, ni exportée, ni enregistrée sur le serveur, qui s’en sert seulement le temps de chaque question.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Fournisseur d’IA">
        {AI_PROVIDERS.map((p) => {
          const has = !!mine.keys[p.key]?.key;
          const active = mine.active === p.key;
          return (
            <button key={p.key} type="button" role="radio" aria-checked={provider === p.key} onClick={() => pick(p.key)}
              className={`ui-btn rounded-lg border px-3 py-2 text-left cursor-pointer transition-colors ${provider === p.key ? 'border-accent bg-accent/10' : 'border-line hover:border-accent'}`}>
              <div className="text-sm font-semibold flex items-center gap-1.5">{p.label}{active && <Check size={13} className="text-good" />}</div>
              <div className="text-[11px] text-mute">{has ? (active ? 'Utilisée' : 'Enregistrée') : 'Aucune clé'}</div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-mute">Où la trouver : <span className="text-ink select-all">{meta.where}</span> · {meta.free}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={saved ? `Clé ${meta.label} (enregistrée : ${masked(saved.key)})` : `Clé ${meta.label}`}>
            <div className="flex gap-2">
              <Input type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={saved ? 'Colle une nouvelle clé pour la remplacer' : 'Colle ta clé ici'} />
              <button type="button" aria-label={show ? 'Masquer la clé' : 'Afficher la clé'} onClick={() => setShow((v) => !v)} className="ui-icon-btn px-2 rounded-lg border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
          </Field>
          <Field label="Modèle (facultatif)" hint={`Par défaut : ${meta.defaultModel}`}>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={meta.defaultModel} spellCheck={false} />
          </Field>
          <div className="flex items-end gap-2 flex-wrap">
            <Button onClick={run} disabled={testing || (!draft.trim() && !saved)}>
              <span className="flex items-center gap-1.5">{testing && <Loader2 size={14} className="animate-spin" />} {saved && !draft.trim() ? 'Tester' : 'Tester et enregistrer'}</span>
            </Button>
          </div>
        </div>
        {result && <p className={`text-sm ${result.ok ? 'text-good' : 'text-bad'}`}>{result.text}</p>}
        {saved && (
          <div className="flex flex-wrap gap-2">
            {mine.active !== provider && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => { setActive(provider); toast(`L’assistant utilise maintenant ${meta.label}.`, 'success'); }}>Utiliser {meta.label}</Button>}
            {mine.active && <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => { setActive(null); toast('L’assistant utilise le service gratuit du site.', 'info'); }}>Revenir au service du site</Button>}
            <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => { if (confirm(`Supprimer ta clé ${meta.label} de cet appareil ?`)) { removeKey(provider); setModel(''); setResult(null); } }}>
              <span className="flex items-center gap-1.5"><Trash2 size={13} /> Supprimer la clé</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
