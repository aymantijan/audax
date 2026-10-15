import { Link } from 'react-router-dom';
import { Pill, Check, CalendarClock, AlertTriangle, Syringe, ChevronRight } from 'lucide-react';
import { useHealthStore } from '../../store/healthStore';
import { dosesOn, stockStatus, upcomingAppointments, boostersDue, addDays } from '../../utils/care';
import { todayKey, fmtDate } from '../../utils/formatters';
import { Card, playSeal } from '../common/ui';
import { t } from '../../i18n';

// « Santé du jour » on Aujourd'hui (chantier 7): the doses of the day to tick,
// appointments today or tomorrow, boxes running out, vaccine boosters.
// Nothing at all when none of it applies.
export default function CareTodayCard() {
  const { medications, medLogs, appointments, healthDocs, markDose } = useHealthStore();
  const today = todayKey();
  const doses = dosesOn(medications, medLogs, today);
  const soon = upcomingAppointments(appointments, today).filter((a) => a.date <= addDays(today, 1));
  const low = medications.filter((m) => m.active !== false && stockStatus(m, medLogs)?.low);
  const boosters = boostersDue(healthDocs, today);
  if (!doses.length && !soon.length && !low.length && !boosters.length) return null;
  const left = doses.filter((d) => !d.status).length;

  return (
    <Card
      title={<span className="flex items-center gap-2"><Pill size={15} /> {t('Santé du jour')}</span>}
      action={<Link to="/health?tab=meds" className="text-xs text-accent hover:underline flex items-center gap-1">{t('Ouvrir')} <ChevronRight size={12} /></Link>}
    >
      {doses.length > 0 && (
        <>
          <p className="text-xs text-mute mb-2">{left ? t('{n} prise(s) à noter sur {total}', { n: left, total: doses.length }) : t('Toutes les prises du jour sont notées.')}</p>
          <ul className="space-y-1.5">
            {doses.map((d) => (
              <li key={`${d.med.id}-${d.time}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                <span className="font-data text-xs text-mute w-11 shrink-0">{d.time}</span>
                <span className={`flex-1 text-sm ${d.status ? 'text-mute' : ''} ${d.status === 'taken' ? 'line-through' : ''}`}>{d.med.name}{d.med.dose ? ` · ${d.med.dose}` : ''}{d.status === 'skipped' ? ` · ${t('pas pris')}` : ''}</span>
                <button
                  type="button"
                  aria-pressed={d.status === 'taken'}
                  onClick={(e) => { if (d.status !== 'taken') playSeal(e.currentTarget); markDose(d.med.id, today, d.time, 'taken'); }}
                  className={`ui-btn flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs cursor-pointer ${d.status === 'taken' ? 'border-good bg-good/15 text-ink' : 'border-line text-mute hover:border-accent'}`}
                >
                  <Check size={13} /> {t('Pris')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {(soon.length > 0 || low.length > 0 || boosters.length > 0) && (
        <ul className={`space-y-1.5 text-sm ${doses.length ? 'mt-3' : ''}`}>
          {soon.map((a) => (
            <li key={a.id} className="flex items-center gap-2"><CalendarClock size={14} className="text-accent shrink-0" /> {a.date === today ? t('Aujourd’hui') : t('Demain')}{a.time ? ` · ${a.time}` : ''} · {a.title}{a.place ? ` (${a.place})` : ''}</li>
          ))}
          {low.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-warning"><AlertTriangle size={14} className="shrink-0" /> {t('{name} : bientôt plus de stock, pense à racheter.', { name: m.name })}</li>
          ))}
          {boosters.map((d) => (
            <li key={d.id} className="flex items-center gap-2"><Syringe size={14} className="text-warning shrink-0" /> {t('Rappel de vaccin : {name}, le {date}', { name: d.title, date: fmtDate(d.nextDate) })}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
