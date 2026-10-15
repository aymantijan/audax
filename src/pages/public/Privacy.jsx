import { Link } from 'react-router-dom';
import PublicPage from '../../components/layout/PublicPage';
import { FEEDBACK_EMAIL } from '../../utils/feedback';
import { useLang } from '../../i18n';
import { t } from '../../i18n';

// Politique de confidentialité (chantier 8, V1). Written for loi 09-08
// (Maroc). Kept in French for now. Facts here must match the code: update
// this page whenever data, providers or retention change.
export const LEGAL_UPDATED = '15 octobre 2026';

export function Section({ title, children }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">{children}</div>
    </section>
  );
}

export function FrenchOnlyNote() {
  const lang = useLang((s) => s.lang);
  if (lang === 'fr') return null;
  return <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm">{t('Ce document existe pour l’instant en français seulement.')}</p>;
}

const mail = <a className="text-accent underline" href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>;

export default function Privacy() {
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
      <p className="text-mute text-sm mt-1">Mise à jour le {LEGAL_UPDATED}</p>
      <FrenchOnlyNote />

      <Section title="En bref">
        <ul>
          <li>Tes données servent à une seule chose : te rendre le service. Pas de publicité, pas de revente, pas de traceur publicitaire.</li>
          <li>Sans compte, tout reste sur ton appareil. Avec un compte, une copie est gardée en ligne pour te suivre sur tes appareils.</li>
          <li>Tu peux tout exporter et tout supprimer, à tout moment, depuis Paramètres.</li>
        </ul>
      </Section>

      <Section title="Qui est responsable ?">
        <p>VAUDAX est un service personnel, gratuit, actuellement ouvert à un cercle privé de personnes invitées. Le responsable du traitement est l’éditeur de VAUDAX, joignable à l’adresse {mail}.</p>
        <p>Le service est soumis à la loi marocaine n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel. La déclaration auprès de la CNDP (Commission nationale de contrôle de la protection des données à caractère personnel) sera faite avant toute ouverture au public.</p>
      </Section>

      <Section title="Quelles données ?">
        <ul>
          <li><b>Ton compte</b> : adresse e-mail, prénom et nom, et, si tu les donnes, sexe, année de naissance, taille, pays, métier. Ton mot de passe est géré par notre fournisseur d’authentification et n’est jamais lisible par nous.</li>
          <li><b>Ce que tu notes</b> : habitudes, objectifs, études, lectures, argent, et santé (sommeil, repas, sport, poids, cycle, médicaments, mesures comme la tension ou la glycémie, rendez-vous, documents et photos que tu ajoutes, fiche d’urgence).</li>
          <li><b>Données techniques</b> : en cas d’erreur de l’application, le message d’erreur, la page, la version et le type de navigateur (sans ton contenu) ; les abonnements aux notifications de tes appareils ; un compteur de questions posées à l’assistant.</li>
        </ul>
        <p>Les informations de santé sont des données sensibles. Tu les notes de ton plein gré, pour ton propre suivi ; tu peux les modifier ou les supprimer à tout moment. Si tu ne veux pas qu’elles soient gardées en ligne, utilise VAUDAX sans compte.</p>
      </Section>

      <Section title="Où sont-elles gardées ?">
        <ul>
          <li><b>Sur ton appareil</b>, dans le stockage du navigateur, pour fonctionner même hors connexion.</li>
          <li><b>Avec un compte</b>, dans la base de données de notre hébergeur (Supabase). Chaque personne ne peut lire que ses propres données, grâce à des règles d’accès appliquées par la base elle-même.</li>
          <li>Le site est servi par Vercel. Ces prestataires peuvent héberger les données hors du Maroc ; les échanges sont chiffrés (HTTPS).</li>
          <li>Les clés d’IA personnelles que tu enregistres sont chiffrées sur le serveur ; seuls leurs 4 derniers caractères te sont réaffichés.</li>
        </ul>
      </Section>

      <Section title="Qui d’autre peut les voir ?">
        <ul>
          <li><b>Personne par défaut.</b></li>
          <li><b>Classement</b> : seulement si tu choisis d’y apparaître, et seulement ton pseudo, ton XP et, si tu le veux, ton métier.</li>
          <li><b>Défis entre amis</b> : les membres d’un défi que tu rejoins voient ton prénom et ton score dans ce défi.</li>
          <li><b>Assistant IA</b> : quand tu poses une question, un résumé des parties que tu as cochées (jamais le détail brut) est envoyé au fournisseur d’IA (Google Gemini par défaut, ou celui de ta clé personnelle : Anthropic, OpenAI, OpenRouter) pour obtenir la réponse. Une photo d’emploi du temps ou de ticket n’est envoyée que si tu utilises cette fonction.</li>
          <li><b>Google Agenda</b> : seulement si tu le connectes, pour y placer les événements que tu choisis.</li>
          <li><b>Retours</b> : un message « Une idée, un problème ? » part de ta propre messagerie, avec l’écran et le type d’appareil.</li>
        </ul>
      </Section>

      <Section title="Combien de temps ?">
        <ul>
          <li>Tes données : tant que ton compte existe. « Effacer mes données » dans Paramètres les supprime.</li>
          <li>La corbeille de l’appareil garde un élément supprimé 30 jours.</li>
          <li>Le journal d’erreurs est effacé automatiquement après 90 jours.</li>
        </ul>
      </Section>

      <Section title="Tes droits">
        <p>Tu as le droit d’accéder à tes données, de les corriger, de t’opposer à leur traitement et de les faire supprimer. La plupart se font seul, dans Paramètres : export (sauvegarde complète ou tableur), modification de chaque saisie, effacement. Pour le reste, ou pour supprimer ton compte, écris à {mail} : réponse sous 30 jours.</p>
        <p>Tu peux aussi saisir la CNDP (www.cndp.ma).</p>
      </Section>

      <Section title="Sécurité">
        <p>Connexions chiffrées, mot de passe d’au moins 12 caractères, règles d’accès par personne dans la base, clés chiffrées. Aucun système n’est parfait : en cas de problème touchant tes données, tu seras prévenu.</p>
      </Section>

      <Section title="Cookies et stockage">
        <p>VAUDAX n’utilise ni cookie publicitaire ni outil de mesure d’audience. Le stockage du navigateur sert uniquement au fonctionnement : ta session, tes réglages d’affichage et tes données hors connexion.</p>
      </Section>

      <Section title="Changements">
        <p>Si cette politique change, la date en haut de page change aussi, et un changement important te sera signalé dans l’application. Voir aussi les <Link className="text-accent underline" to="/conditions">conditions d’utilisation</Link>.</p>
      </Section>
    </PublicPage>
  );
}
