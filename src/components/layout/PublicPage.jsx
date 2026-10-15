import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { FEEDBACK_EMAIL } from '../../utils/feedback';
import { t } from '../../i18n';
import { PUBLIC_LINKS } from '../../utils/landing-content';

// Frame of the pages anyone can open without an account (chantier 8):
// présentation, installation, confidentialité, conditions, accessibilité.
export function PublicFooter() {
  return (
    <footer className="border-t border-line mt-12 pt-6 pb-10 text-sm text-mute">
      <nav aria-label={t('Liens utiles')} className="flex flex-wrap gap-x-5 gap-y-2">
        {PUBLIC_LINKS.map((l) => <Link key={l.to} to={l.to} className="hover:text-ink underline-offset-4 hover:underline">{t(l.label)}</Link>)}
        <a href={`mailto:${FEEDBACK_EMAIL}`} className="hover:text-ink underline-offset-4 hover:underline">{t('Contact')}</a>
      </nav>
      <p className="mt-4 text-xs">{t('VAUDAX est gratuit, sans publicité, et ne vend aucune donnée.')}</p>
    </footer>
  );
}

export default function PublicPage({ children, narrow = true }) {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="min-h-screen bg-base text-ink">
      <header className="border-b border-line bg-surface">
        <div className={`${narrow ? 'max-w-3xl' : 'max-w-5xl'} mx-auto px-4 h-16 flex items-center justify-between gap-3`}>
          <Link to="/decouvrir" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center"><Zap size={16} className="text-on-accent" /></span>
            <span className="font-display text-xl tracking-widest">VAUDAX</span>
          </Link>
          <Link to={user ? '/today' : '/welcome'} className="ui-btn rounded-lg border border-line px-3 py-2 text-sm hover:border-accent">{user ? t('Ouvrir VAUDAX') : t('Se connecter')}</Link>
        </div>
      </header>
      <main className={`${narrow ? 'max-w-3xl' : 'max-w-5xl'} mx-auto px-4 py-8`}>
        {children}
        <PublicFooter />
      </main>
    </div>
  );
}
