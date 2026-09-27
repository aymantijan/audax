import { useEffect, useState } from 'react';
import { KeyRound, Check, Eye, EyeOff, Trash2, Loader2, Cloud, Smartphone } from 'lucide-react';
import { useAiKeyStore, AI_PROVIDERS, currentOwnerId } from '../../store/aiKeyStore';
import { testAiKey, ASSISTANT_ERRORS } from '../../services/assistant';
import { fetchAccountKeys, saveAccountKey, deleteAccountKey, activateAccountKey, toKeyState } from '../../services/ai-keys';
import { Button, Field, Input } from '../common/ui';
import { toast } from '../../store/uiStore';

const EMPTY = { active: null, keys: {} };

// Bring your own AI key: Gemini, Claude, ChatGPT or OpenRouter.
// Signed in: saved on the account, encrypted, used on every device.
// Without an account: kept on this device only.
export default function AiKeysSection() {
  const byOwner = useAiKeyStore((s) => s.byOwner);
  const local = useAiKeyStore.getState();
  const localMine = byOwner[currentOwnerId()] || EMPTY;
  const [mode, setMode] = useState('loading'); // 'loading' | 'account' | 'device'
  const [account, setAccount] = useState(EMPTY);
  const [provider, setProvider] = useState('gemini');
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  // Keys shown: from the account, or the local ones ({ key } → last4).
  const mine = mode === 'account' ? account : {
    active: localMine.active,
    keys: Object.fromEntries(Object.entries(localMine.keys).map(([p, k]) => [p, { last4: (k.key || '').slice(-4), model: k.model }])),
  };
  const saved = mine.keys[provider];
  const meta = AI_PROVIDERS.find((p) => p.key === provider);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetchAccountKeys();
      if (!alive) return;
      if (!r.ok) { setMode('device'); return; }
      let list = r.keys;
      // Keys entered earlier on this device move to the account, then leave the device.
      const here = useAiKeyStore.getState().byOwner[currentOwnerId()] || EMPTY;
      const pending = Object.entries(here.keys).filter(([, k]) => k?.key);
      if (pending.length) {
        for (const [p, k] of pending) {
          const s = await saveAccountKey(p, k.key, k.model);
          if (s.ok) { list = s.keys; useAiKeyStore.getState().removeKey(p); }
        }
        if (here.active && list.some((k) => k.provider === here.active)) {
          const a = await activateAccountKey(here.active);
          if (a.ok) list = a.keys;
        }
        if (alive) toast('Tes clés d’IA sont maintenant enregistrées sur ton compte.', 'success');
      }
      if (!alive) return;
      const st = toKeyState(list);
      setAccount(st);
      setMode('account');
      if (st.active) setProvider(st.active);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { setModel(mine.keys[provider]?.model || ''); }, [provider, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p) => { setProvider(p); setDraft(''); setResult(null); };

  const run = async () => {
    const key = draft.trim();
    if (!key && !saved) { setResult({ ok: false, text: 'Colle d’abord ta clé.' }); return; }
    setBusy(true);
    setResult(null);
    if (!key) {
      // Test the saved key: on the account it is used server-side, so ask with
      // that provider active; on the device, send it.
      const localKey = localMine.keys[provider]?.key;
      const r = mode === 'device' ? await testAiKey(provider, localKey, model) : await testSaved(provider);
      setBusy(false);
      setResult(r.ok ? { ok: true, text: 'La clé fonctionne.' } : { ok: false, text: ASSISTANT_ERRORS[r.code] || ASSISTANT_ERRORS.failed });
      return;
    }
    const r = await testAiKey(provider, key, model);
    if (!r.ok && !['offline', 'auth', 'not_configured'].includes(r.code)) {
      setBusy(false);
      setResult({ ok: false, text: ASSISTANT_ERRORS[r.code] || ASSISTANT_ERRORS.failed });
      return;
    }
    if (mode === 'account') {
      const s = await saveAccountKey(provider, key, model);
      setBusy(false);
      if (!s.ok) { setResult({ ok: false, text: 'Impossible d’enregistrer la clé sur ton compte pour l’instant. Réessaie.' }); return; }
      setAccount(toKeyState(s.keys));
      toast(`Clé ${meta.label} enregistrée sur ton compte : elle marche sur tous tes appareils.`, 'success');
    } else {
      setBusy(false);
      local.setKey(provider, key, model);
      toast(`Clé ${meta.label} enregistrée sur cet appareil.`, r.ok ? 'success' : 'warning');
    }
    setDraft('');
    setResult(r.ok ? { ok: true, text: 'La clé fonctionne.' } : { ok: false, text: `Clé enregistrée, mais pas encore vérifiée : ${ASSISTANT_ERRORS[r.code] || ''}` });
  };

  // Uses whatever key the account has active; temporarily activating the one to test.
  const testSaved = async (p) => {
    const before = account.active;
    if (before !== p) await activateAccountKey(p);
    const r = await testAiKey(null);
    if (before !== p) await activateAccountKey(before);
    return r;
  };

  const activate = async (p) => {
    if (mode === 'account') {
      const a = await activateAccountKey(p);
      if (!a.ok) { toast('Changement impossible pour l’instant.', 'error'); return; }
      setAccount(toKeyState(a.keys));
    } else local.setActive(p);
    toast(p ? `L’assistant utilise maintenant ${AI_PROVIDERS.find((x) => x.key === p).label}.` : 'L’assistant utilise le service gratuit du site.', p ? 'success' : 'info');
  };

  const remove = async () => {
    if (!confirm(`Supprimer ta clé ${meta.label}${mode === 'account' ? ' de ton compte (sur tous tes appareils)' : ' de cet appareil'} ?`)) return;
    if (mode === 'account') {
      const d = await deleteAccountKey(provider);
      if (!d.ok) { toast('Suppression impossible pour l’instant.', 'error'); return; }
      setAccount(toKeyState(d.keys));
    } else local.removeKey(provider);
    setModel('');
    setResult(null);
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
      <div className="flex items-start gap-2.5">
        <KeyRound size={16} className="text-accent mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold">Ta clé d’IA</div>
          <p className="text-mute text-xs mt-0.5">
            Utilise ton propre compte d’IA : pas de limite VAUDAX, c’est ton fournisseur qui fixe ses conditions (gratuites ou payantes).
          </p>
          {mode === 'account' && (
            <p className="text-xs mt-1.5 flex items-start gap-1.5 text-good"><Cloud size={13} className="mt-0.5 shrink-0" />
              Enregistrée sur ton compte, chiffrée : elle marche sur tous tes appareils. Une fois enregistrée, personne ne peut la relire, pas même toi (seulement ses 4 derniers caractères).</p>
          )}
          {mode === 'device' && (
            <p className="text-xs mt-1.5 flex items-start gap-1.5 text-mute"><Smartphone size={13} className="mt-0.5 shrink-0" />
              Sans connexion à ton compte, la clé reste sur cet appareil seulement. Connecte-toi (Synchronisation) pour l’avoir partout.</p>
          )}
        </div>
      </div>

      {mode === 'loading' ? (
        <p className="text-sm text-mute flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement de tes clés…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Fournisseur d’IA">
            {AI_PROVIDERS.map((p) => {
              const has = !!mine.keys[p.key];
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
              <Field label={saved ? `Clé ${meta.label} (enregistrée : ••••${saved.last4})` : `Clé ${meta.label}`}>
                <div className="flex gap-2">
                  <Input type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={saved ? 'Colle une nouvelle clé pour la remplacer' : 'Colle ta clé ici'} />
                  <button type="button" aria-label={show ? 'Masquer la clé' : 'Afficher la clé'} onClick={() => setShow((v) => !v)} className="ui-icon-btn px-2 rounded-lg border border-line text-mute hover:text-ink cursor-pointer flex items-center justify-center">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </Field>
              <Field label="Modèle (facultatif)" hint={`Par défaut : ${meta.defaultModel}`}>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={meta.defaultModel} spellCheck={false} />
              </Field>
              <div className="flex items-end gap-2 flex-wrap">
                <Button onClick={run} disabled={busy || (!draft.trim() && !saved)}>
                  <span className="flex items-center gap-1.5">{busy && <Loader2 size={14} className="animate-spin" />} {saved && !draft.trim() ? 'Tester' : 'Tester et enregistrer'}</span>
                </Button>
              </div>
            </div>
            {result && <p className={`text-sm ${result.ok ? 'text-good' : 'text-bad'}`}>{result.text}</p>}
            {saved && (
              <div className="flex flex-wrap gap-2">
                {mine.active !== provider && <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => activate(provider)}>Utiliser {meta.label}</Button>}
                {mine.active && <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => activate(null)}>Revenir au service du site</Button>}
                <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={remove}>
                  <span className="flex items-center gap-1.5"><Trash2 size={13} /> Supprimer la clé</span>
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
