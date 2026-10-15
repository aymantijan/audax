import PublicPage from '../../components/layout/PublicPage';
import { FEEDBACK_EMAIL } from '../../utils/feedback';
import { Section, FrenchOnlyNote, LEGAL_UPDATED } from './Privacy';

// Déclaration d'accessibilité (chantier 8, V5). Honest: the target, what is
// done, what is not yet. Update it with each accessibility change.
export default function Accessibility() {
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Accessibilité</h1>
      <p className="text-mute text-sm mt-1">Mise à jour le {LEGAL_UPDATED}</p>
      <FrenchOnlyNote />

      <Section title="Notre objectif">
        <p>VAUDAX doit pouvoir servir à tout le monde, y compris aux personnes âgées, malvoyantes ou qui ont du mal avec les gestes fins. Nous visons le niveau AA des règles internationales d’accessibilité du web (WCAG 2.1). Ce niveau n’a pas encore été vérifié par un organisme extérieur : VAUDAX est <b>partiellement conforme</b>.</p>
      </Section>

      <Section title="Ce qui est en place">
        <ul>
          <li>Trois tailles de texte (normal, grand, très grand) et un mode contraste fort, dès le premier écran.</li>
          <li>Un mode Simple, sans jargon, avec une explication au toucher pour les termes techniques.</li>
          <li>Des boutons d’au moins 48 points, nommés pour les lecteurs d’écran.</li>
          <li>Les fenêtres se ferment avec la touche Échap ; sur téléphone, elles s’ouvrent par le bas.</li>
          <li>Une aide « ? » sur chaque écran et une visite guidée.</li>
          <li>Quatre langues, dont l’arabe affiché de droite à gauche.</li>
          <li>Tout se corrige et toute suppression s’annule, pour ne jamais être piégé par une erreur.</li>
        </ul>
      </Section>

      <Section title="Ce qui n’est pas encore accessible">
        <ul>
          <li>Les graphiques n’ont pas toujours de description textuelle : les chiffres sont en général repris à côté, mais pas partout.</li>
          <li>La vue en 3D des compétences ne se parcourt pas au clavier ni au lecteur d’écran.</li>
          <li>Plusieurs pages détaillées (Santé, Finances, Études) ne sont encore qu’en français.</li>
          <li>Quelques glisser-déposer n’ont pas encore d’équivalent par boutons.</li>
        </ul>
      </Section>

      <Section title="Un problème ?">
        <p>Si un écran est difficile à lire ou à utiliser, dis-le : bouton « Une idée, un problème ? » dans le menu du profil, ou e-mail à <a className="text-accent underline" href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>. Nous répondons et proposons une autre façon d’accéder à l’information.</p>
      </Section>
    </PublicPage>
  );
}
