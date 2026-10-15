import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb, Bug, Mail } from 'lucide-react';
import { Modal, Button, Field, Textarea } from '../common/ui';
import { t } from '../../i18n';
import { feedbackMailto } from '../../utils/feedback';

// « Une idée, un problème ? » (chantier 8, D4): opens the person's own mail
// app with a ready message — nothing is sent without them pressing Send.
// The screen and device are added so a problem can be found again.
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'; // eslint-disable-line no-undef

export default function FeedbackModal({ open, onClose }) {
  const { pathname } = useLocation();
  const [kind, setKind] = useState('idea');
  const [message, setMessage] = useState('');
  const chip = (on) => `ui-btn flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute'}`;
  const send = () => {
    window.location.href = feedbackMailto({ kind, message, path: pathname, userAgent: navigator.userAgent, version: APP_VERSION });
    setMessage('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('Une idée, un problème ?')}>
      <div className="space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label={t('Type de message')}>
          <button type="button" role="radio" aria-checked={kind === 'idea'} className={chip(kind === 'idea')} onClick={() => setKind('idea')}><Lightbulb size={15} /> {t('Une idée')}</button>
          <button type="button" role="radio" aria-checked={kind === 'bug'} className={chip(kind === 'bug')} onClick={() => setKind('bug')}><Bug size={15} /> {t('Un problème')}</button>
        </div>
        <Field label={kind === 'bug' ? t('Que s’est-il passé ?') : t('Ton idée')}>
          <Textarea rows={5} autoFocus value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === 'bug' ? t('Ce que tu faisais, ce qui s’est passé, ce que tu attendais.') : t('Ce qui t’aiderait, ce qui manque, ce qui est compliqué.')} />
        </Field>
        <p className="text-xs text-mute">{t('Ton appli d’e-mail s’ouvre avec le message prêt : tu le relis et tu l’envoies. L’écran et le type d’appareil sont ajoutés pour retrouver le problème, rien d’autre.')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('Annuler')}</Button>
          <Button onClick={send} disabled={!message.trim()}><span className="flex items-center gap-1.5"><Mail size={15} /> {t('Écrire l’e-mail')}</span></Button>
        </div>
      </div>
    </Modal>
  );
}
