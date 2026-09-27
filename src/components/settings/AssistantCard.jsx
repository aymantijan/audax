import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ASSISTANT_SCOPES, DEFAULT_SCOPES } from '../../utils/assistant-context';
import { openAssistant } from '../../services/assistant';
import { Card, Button, Field, Textarea } from '../common/ui';
import { toast } from '../../store/uiStore';
import AiKeysSection from './AiKeysSection';

// What the assistant may read, and the facts it should always keep in mind.
// Both live in the profile (synced with the account); the conversation itself
// is never stored.
export default function AssistantCard() {
  const { user, updateProfile } = useAuthStore();
  const ref = useRef(null);
  const scopes = user?.assistant?.scopes || DEFAULT_SCOPES;
  const [facts, setFacts] = useState((user?.assistant?.facts || []).join('\n'));

  useEffect(() => {
    if (window.location.hash === '#assistant') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const save = (patch) => updateProfile({ assistant: { scopes, facts: user?.assistant?.facts || [], ...patch } });
  const toggle = (key) => save({ scopes: scopes.includes(key) ? scopes.filter((k) => k !== key) : [...scopes, key] });
  const saveFacts = () => {
    const list = facts.split('\n').map((f) => f.trim()).filter(Boolean).slice(0, 20);
    save({ facts: list });
    toast('C’est noté.', 'success');
  };

  return (
    <div id="assistant" ref={ref} className="scroll-mt-32">
      <Card title="Assistant" action={<Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => openAssistant()}><span className="flex items-center gap-1.5"><Sparkles size={13} /> Ouvrir</span></Button>}>
        <p className="text-sm text-mute mb-3">
          L’assistant lit un résumé de tes données (jamais le détail brut) pour répondre, uniquement dans les sections cochées. Il ne modifie rien.
          Sans clé personnelle, il utilise le service gratuit du site (30 questions par jour et par personne), s’il est activé.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
          {ASSISTANT_SCOPES.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} className="cursor-pointer" />
              {s.label}
            </label>
          ))}
        </div>
        <Field label="À retenir sur toi" hint="Une info par ligne, par exemple « Je prépare un concours en juin » ou « Je travaille le soir ». L’assistant en tiendra toujours compte.">
          <Textarea rows={3} value={facts} onChange={(e) => setFacts(e.target.value)} maxLength={2000} />
        </Field>
        <div className="flex justify-end mt-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={saveFacts}>Enregistrer</Button>
        </div>
        <div className="mt-5"><AiKeysSection /></div>
      </Card>
    </div>
  );
}
