import { Link } from 'react-router-dom';
import PublicPage from '../../components/layout/PublicPage';
import { FEEDBACK_EMAIL } from '../../utils/feedback';
import { Section, FrenchOnlyNote, LEGAL_UPDATED } from './Privacy';

// Conditions d'utilisation (chantier 8, V1). Kept in French for now.
export default function Terms() {
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Conditions d’utilisation</h1>
      <p className="text-mute text-sm mt-1">Mise à jour le {LEGAL_UPDATED}</p>
      <FrenchOnlyNote />

      <Section title="Le service">
        <p>VAUDAX aide à organiser sa journée, sa santé, ses études et son argent. Il est gratuit, sans publicité, et actuellement réservé à un cercle privé de personnes invitées. En créant un compte ou en utilisant le site, tu acceptes ces conditions et la <Link className="text-accent underline" to="/confidentialite">politique de confidentialité</Link>.</p>
      </Section>

      <Section title="Ce que VAUDAX n’est pas">
        <ul>
          <li><b>Pas un avis médical.</b> Les repères (tension, glycémie, sommeil…), les rappels de médicaments et les conseils servent à t’aider à suivre, pas à diagnostiquer ni à soigner. En cas de doute, demande l’avis d’un médecin ou d’un pharmacien. En urgence, appelle les secours.</li>
          <li><b>Pas un conseil financier.</b> Les calculs et estimations (budget, épargne, impôts) sont indicatifs.</li>
          <li><b>Pas une garantie de rappel.</b> Les notifications dépendent de ton téléphone et de ta connexion : ne compte pas uniquement sur elles pour un traitement important.</li>
        </ul>
      </Section>

      <Section title="Ton compte">
        <ul>
          <li>Tu gardes ton mot de passe pour toi et tu es responsable de ce qui est fait avec ton compte.</li>
          <li>Ce que tu notes t’appartient. Tu peux l’exporter et le supprimer à tout moment.</li>
          <li>Pas d’usage illégal, pas de tentative d’accéder aux données des autres, pas de contenu offensant dans les pseudos ou les défis.</li>
        </ul>
      </Section>

      <Section title="Disponibilité">
        <p>Le service est fourni tel quel, sans garantie de disponibilité permanente. Il peut évoluer, s’interrompre pour maintenance ou s’arrêter ; dans ce dernier cas, tu seras prévenu à l’avance pour récupérer tes données. Pense à télécharger une sauvegarde de temps en temps (Paramètres → Tes données).</p>
      </Section>

      <Section title="Fin d’utilisation">
        <p>Tu peux arrêter quand tu veux et effacer tes données depuis Paramètres. Un compte qui ne respecte pas ces conditions peut être suspendu.</p>
      </Section>

      <Section title="Droit applicable et contact">
        <p>Ces conditions sont soumises au droit marocain. Une question, un désaccord : écris à <a className="text-accent underline" href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>.</p>
      </Section>
    </PublicPage>
  );
}
