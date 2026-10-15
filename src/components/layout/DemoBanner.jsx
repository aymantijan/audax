import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { endDemo } from '../../services/demo';
import { Button } from '../common/ui';
import { t } from '../../i18n';

// Shown everywhere while the « Voir un exemple » profile is open.
export default function DemoBanner() {
  const demo = useAuthStore((s) => !!s.user?.demo);
  const navigate = useNavigate();
  if (!demo) return null;
  const leave = async (to) => { await endDemo(); navigate(to, { replace: true }); };
  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2.5">
        <Eye size={16} className="text-accent shrink-0" />
        <p className="text-sm flex-1 min-w-[12rem]">{t('Tu regardes un exemple. Essaie tout ce que tu veux : rien n’est enregistré sur un compte, et tout s’efface en quittant.')}</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => leave('/decouvrir')}>{t('Quitter l’exemple')}</Button>
          <Button className="!px-3 !py-1.5 text-xs" onClick={() => leave('/welcome')}>{t('Créer mon compte')}</Button>
        </div>
      </div>
    </div>
  );
}
