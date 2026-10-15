import { useNavigate, Link } from 'react-router-dom';
import { Sun, HeartPulse, Wallet, GraduationCap, ShieldCheck, Type, RotateCcw, Smartphone, Eye, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { canOfferDemo, startDemo } from '../../services/demo';
import PublicPage from '../../components/layout/PublicPage';
import DisplayControls from '../../components/common/DisplayControls';
import { Button } from '../../components/common/ui';
import { t } from '../../i18n';
import { PILLARS, FOR_WHOM, PROMISES } from '../../utils/landing-content';

// Présentation (chantier 8, V2/V3): one promise, four pillars, who it is
// for, how data is treated, then « Créer mon compte » or « Voir un exemple ».
const ICONS = { sun: Sun, health: HeartPulse, money: Wallet, learn: GraduationCap, type: Type, undo: RotateCcw, phone: Smartphone, shield: ShieldCheck };

export default function Landing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const demoOk = !user && canOfferDemo();
  const tryDemo = () => { startDemo(); navigate('/today', { replace: true }); };

  return (
    <PublicPage narrow={false}>
      <section className="text-center max-w-2xl mx-auto py-6">
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{t('Ta journée, ta santé et ton argent, au même endroit, à ton rythme.')}</h1>
        <p className="text-mute mt-4 text-[1.05rem]">{t('VAUDAX remplace les carnets, les rappels et les applications éparpillées par un seul écran clair, qu’on ait 18 ou 90 ans.')}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-7">
          <Button onClick={() => navigate(user ? '/today' : '/welcome')}>{user ? t('Ouvrir VAUDAX') : t('Créer mon compte')}</Button>
          {demoOk && <Button variant="secondary" onClick={tryDemo}><span className="flex items-center gap-2"><Eye size={16} /> {t('Voir un exemple')}</span></Button>}
        </div>
        {demoOk && <p className="text-xs text-mute mt-3">{t('L’exemple s’ouvre sans compte et s’efface quand tu le quittes.')}</p>}
      </section>

      <section className="max-w-md mx-auto mt-6 rounded-xl border border-line bg-card p-3" aria-label={t('Langue et confort de lecture')}>
        <DisplayControls compact />
      </section>

      <section className="grid sm:grid-cols-2 gap-4 mt-12">
        {PILLARS.map((p) => { const Icon = ICONS[p.icon]; return (
          <div key={p.title} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center gap-2.5 mb-2"><span className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center"><Icon size={18} /></span><h2 className="text-lg font-semibold">{t(p.title)}</h2></div>
            <p className="text-mute">{t(p.text)}</p>
          </div>
        ); })}
      </section>

      <section className="grid md:grid-cols-2 gap-8 mt-12">
        <div>
          <h2 className="text-xl font-bold mb-3">{t('Pour qui ?')}</h2>
          <ul className="space-y-2">{FOR_WHOM.map((x) => <li key={x} className="flex gap-2"><Check size={18} className="text-good shrink-0 mt-0.5" /> {t(x)}</li>)}</ul>
          <p className="text-mute text-sm mt-3">{t('Tu choisis ce qui t’aide : le reste reste caché.')}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3">{t('Ce qui ne change jamais')}</h2>
          <ul className="space-y-3">{PROMISES.map((p) => { const Icon = ICONS[p.icon]; return <li key={p.text} className="flex gap-2.5"><Icon size={18} className="text-accent shrink-0 mt-0.5" /> {t(p.text)}</li>; })}</ul>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-card p-6 text-center">
        <h2 className="text-xl font-bold">{t('Gratuit, en français, anglais, espagnol et arabe')}</h2>
        <p className="text-mute mt-2">{t('Pas d’application à télécharger dans un magasin : VAUDAX s’installe depuis le navigateur, en deux gestes.')}</p>
        <Link to="/installer" className="inline-block mt-4 text-accent hover:underline">{t('Comment l’installer sur mon téléphone')}</Link>
      </section>
    </PublicPage>
  );
}
