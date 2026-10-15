import { useState } from 'react';
import { Smartphone, Monitor, Bell } from 'lucide-react';
import PublicPage from '../../components/layout/PublicPage';
import { INSTALL_STEPS } from '../../utils/landing-content';
import { t } from '../../i18n';

// « Installer sur ton téléphone » (chantier 8, V4/G12): no app store, the site
// installs itself from the browser. The right tab opens by itself.
const guess = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPhone|iPad/.test(ua) ? 'iphone' : /Android/.test(ua) ? 'android' : 'computer';
};
const TABS = [
  { key: 'iphone', label: 'iPhone / iPad', icon: Smartphone },
  { key: 'android', label: 'Android', icon: Smartphone },
  { key: 'computer', label: 'Ordinateur', icon: Monitor },
];

export default function Install() {
  const [os, setOs] = useState(guess);
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">{t('Installer VAUDAX sur ton téléphone')}</h1>
      <p className="text-mute mt-2">{t('Pas besoin de magasin d’applications : VAUDAX s’installe depuis le navigateur. Une fois installé, il s’ouvre comme une application, même sans connexion, et peut t’envoyer des rappels.')}</p>
      <div className="flex flex-wrap gap-2 mt-6" role="tablist" aria-label={t('Ton appareil')}>
        {TABS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={os === x.key} onClick={() => setOs(x.key)}
            className={`ui-btn flex items-center gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer ${os === x.key ? 'border-accent bg-accent/10 text-accent' : 'border-line text-mute hover:text-ink'}`}>
            <x.icon size={15} /> {t(x.label)}
          </button>
        ))}
      </div>
      <ol className="mt-6 space-y-4">
        {INSTALL_STEPS[os].map((s, i) => (
          <li key={s} className="flex gap-4 rounded-xl border border-line bg-card p-4">
            <span className="w-9 h-9 shrink-0 rounded-full bg-accent text-on-accent font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-[1.05rem] leading-relaxed pt-1">{t(s)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-xl border border-line bg-surface p-4 flex gap-3 text-sm">
        <Bell size={18} className="text-accent shrink-0 mt-0.5" />
        <p>{os === 'iphone' ? t('Sur iPhone, les rappels ne marchent qu’une fois VAUDAX ajouté à l’écran d’accueil (iOS 16.4 ou plus récent). Ouvre-le ensuite depuis l’icône et active les notifications dans Paramètres.') : t('Pour recevoir les rappels (médicaments, rendez-vous, cours), active les notifications dans Paramètres → Notifications.')}</p>
      </div>
    </PublicPage>
  );
}
