import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { moduleOfPath } from '../../utils/navigation';
import { helpFor, TOUR } from '../../utils/help';
import { Modal, Button } from '../common/ui';
import { t } from '../../i18n';

// The guided tour: four short screens. Shown once to new accounts (Simple
// mode, never seen), and again on demand from the « ? ».
export function Tour({ open, onClose }) {
  const [i, setI] = useState(0);
  const step = TOUR[i];
  const last = i === TOUR.length - 1;
  const close = () => { setI(0); onClose(); };
  return (
    <Modal open={open} onClose={close} title={t(step.title)}>
      <p className="text-[1rem] leading-relaxed">{t(step.text)}</p>
      <div className="flex items-center justify-center gap-1.5 mt-5" aria-label={t('Étape {n} sur {total}', { n: i + 1, total: TOUR.length })}>
        {TOUR.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-accent' : 'w-2 bg-line'}`} />)}
      </div>
      <div className="flex justify-between gap-2 mt-5">
        {i > 0 ? (
          <Button variant="secondary" onClick={() => setI(i - 1)}><span className="flex items-center gap-1"><ChevronLeft size={15} /> {t('Précédent')}</span></Button>
        ) : <Button variant="ghost" onClick={close}>{t('Passer')}</Button>}
        <Button onClick={() => (last ? close() : setI(i + 1))}>
          {last ? t('C’est compris') : <span className="flex items-center gap-1">{t('Suivant')} <ChevronRight size={15} /></span>}
        </Button>
      </div>
    </Modal>
  );
}

// « ? » in the top bar (G11): what this screen is for, in three lines.
export default function HelpButton() {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !!user && user.uiLevel === 'simple' && !user.tourSeen);
  const help = helpFor(moduleOfPath(pathname), pathname);

  const closeTour = () => {
    setTourOpen(false);
    if (!user?.tourSeen) updateProfile({ tourSeen: true });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('Aide sur cet écran')} title={t('Aide sur cet écran')} className="ui-icon-btn flex items-center justify-center p-2 rounded-lg text-mute hover:text-accent hover:bg-card transition-colors cursor-pointer">
        <HelpCircle size={18} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${t('Aide')} · ${t(help.title)}`}>
        <ul className="space-y-3 text-[1rem] leading-relaxed">
          {help.lines.map((l) => <li key={l} className="flex gap-2"><span className="text-accent" aria-hidden="true">•</span><span>{t(l)}</span></li>)}
        </ul>
        <div className="flex flex-wrap justify-between gap-2 mt-6">
          <Button variant="secondary" onClick={() => { setOpen(false); setTourOpen(true); }}>{t('Revoir la visite guidée')}</Button>
          <Button onClick={() => setOpen(false)}>{t('Compris')}</Button>
        </div>
      </Modal>
      <Tour open={tourOpen} onClose={closeTour} />
    </>
  );
}
