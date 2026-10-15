import { Link } from 'react-router-dom';
import { Siren, Phone, Pencil, ArrowLeft } from 'lucide-react';
import { useHealthStore } from '../store/healthStore';
import { useAuthStore } from '../store/authStore';
import { emergencyIsEmpty } from '../utils/care';
import { Button, EmptyState } from '../components/common/ui';

// /urgence (S10): the emergency card in big print, readable by someone else
// at a glance. Works offline (local data). Edited in Santé → Soins.
export default function Emergency() {
  const card = useHealthStore((s) => s.emergencyCard);
  const meds = useHealthStore((s) => s.medications).filter((m) => m.active !== false);
  const user = useAuthStore((s) => s.user);
  const age = user?.dobYear ? new Date().getFullYear() - Number(user.dobYear) : null;
  const block = 'rounded-2xl border-2 border-line bg-card p-4';
  const label = 'text-sm font-semibold uppercase tracking-wide text-mute';

  return (
    <div className="max-w-2xl mx-auto space-y-4 text-[1.15rem] leading-snug">
      <div className="flex items-center justify-between gap-3">
        <Link to="/health?tab=emergency" className="text-sm text-mute hover:text-ink flex items-center gap-1"><ArrowLeft size={15} /> Retour</Link>
        <Link to="/health?tab=emergency"><Button variant="secondary" className="!px-3 !py-1.5 text-xs"><span className="flex items-center gap-1"><Pencil size={13} /> Modifier</span></Button></Link>
      </div>
      <div className="rounded-2xl bg-bad/15 border-2 border-bad p-4 flex items-center gap-3">
        <Siren size={32} className="text-bad shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Fiche d’urgence</h1>
          <p className="text-lg">{user?.name}{age ? ` · ${age} ans` : ''}</p>
        </div>
      </div>

      {emergencyIsEmpty(card) && !meds.length ? (
        <EmptyState icon={Siren} action={<Link to="/health?tab=emergency"><Button>Remplir ma fiche</Button></Link>}>Ta fiche est vide.</EmptyState>
      ) : (
        <>
          {card.bloodType && <div className={block}><div className={label}>Groupe sanguin</div><div className="text-4xl font-bold mt-1 tracking-wide">{card.bloodType}</div></div>}
          {card.allergies && <div className={`${block} border-bad/60`}><div className={label}>Allergies</div><div className="mt-1 font-semibold whitespace-pre-line">{card.allergies}</div></div>}
          {card.conditions && <div className={block}><div className={label}>Maladies, situations</div><div className="mt-1 whitespace-pre-line">{card.conditions}</div></div>}
          {meds.length > 0 && (
            <div className={block}>
              <div className={label}>Traitements en cours</div>
              <ul className="mt-1 space-y-1">{meds.map((m) => <li key={m.id}>{m.name}{m.dose ? ` · ${m.dose}` : ''}{m.times?.length ? ` · ${m.times.join(', ')}` : m.frequency === 'asNeeded' ? ' · au besoin' : ''}</li>)}</ul>
            </div>
          )}
          {card.contacts?.some((c) => c.name || c.phone) && (
            <div className={block}>
              <div className={label}>Personnes à prévenir</div>
              <ul className="mt-2 space-y-2">
                {card.contacts.filter((c) => c.name || c.phone).map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.name}{c.relation ? ` (${c.relation})` : ''}</span>
                    {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="ui-btn inline-flex items-center gap-2 rounded-xl bg-good/15 border border-good px-4 py-2 font-data font-semibold"><Phone size={18} /> {c.phone}</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {card.doctor && <div className={block}><div className={label}>Médecin traitant</div><div className="mt-1">{card.doctor}</div></div>}
          {card.notes && <div className={block}><div className={label}>À savoir aussi</div><div className="mt-1 whitespace-pre-line">{card.notes}</div></div>}
        </>
      )}
    </div>
  );
}
