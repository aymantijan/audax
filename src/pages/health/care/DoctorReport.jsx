import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { useAuthStore } from '../../../store/authStore';
import { adherence, addDays, VITALS, vitalText, vitalZone, upcomingAppointments } from '../../../utils/care';
import { todayKey, fmtDate } from '../../../utils/formatters';
import { Modal, Button } from '../../../components/common/ui';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// « Pour le médecin » (S6, S7): treatments, how they were taken over 30 days,
// recent measurements, allergies. Printable or saved as PDF from the browser.
export default function DoctorReport({ onClose }) {
  const { medications, medLogs, vitals, appointments, emergencyCard } = useHealthStore();
  const name = useAuthStore((s) => s.user?.name);
  const today = todayKey();
  const from = addDays(today, -29);

  const data = useMemo(() => {
    const meds = medications.filter((m) => m.active !== false).map((m) => ({
      m, a: adherence([m], medLogs, from, today, new Date().toTimeString().slice(0, 5)),
      asNeeded: medLogs.filter((l) => l.medId === m.id && l.asNeeded && l.date >= from).length,
    }));
    const byType = Object.keys(VITALS).map((type) => ({ type, rows: vitals.filter((v) => v.type === type).slice(0, 10) })).filter((x) => x.rows.length);
    return { meds, byType, next: upcomingAppointments(appointments, today).slice(0, 3) };
  }, [medications, medLogs, vitals, appointments, from, today]);

  const html = () => {
    const medRows = data.meds.map(({ m, a, asNeeded }) => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${m.frequency === 'asNeeded' ? 'Au besoin' : esc((m.times || []).join(', '))}</td><td>${m.frequency === 'asNeeded' ? `${asNeeded} prise(s)` : a.pct == null ? '—' : `${a.pct} % (${a.taken}/${a.planned})`}</td></tr>`).join('');
    const vitalBlocks = data.byType.map(({ type, rows }) => `<h3>${esc(VITALS[type].label)} (${esc(VITALS[type].unit)})</h3><table><tr><th>Date</th><th>Valeur</th><th>Repère</th></tr>${rows.map((v) => `<tr><td>${esc(fmtDate(v.date))} ${esc(v.time || '')}</td><td>${esc(vitalText(type, v))}${v.context === 'after' ? ' (après repas)' : v.context === 'fasting' ? ' (à jeun)' : ''}</td><td>${esc(vitalZone(type, v)?.label || '')}</td></tr>`).join('')}</table>`).join('');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Résumé santé</title><style>body{font:14px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:20px}h2{font-size:16px;margin-top:22px}h3{font-size:14px;margin:14px 0 4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}p{margin:4px 0}</style></head><body>
<h1>Résumé santé${name ? ` · ${esc(name)}` : ''}</h1><p>Établi le ${esc(fmtDate(today))}, à partir de ce que la personne a noté dans VAUDAX (pas un document médical).</p>
${emergencyCard?.allergies || emergencyCard?.conditions || emergencyCard?.bloodType ? `<h2>À savoir</h2>${emergencyCard.bloodType ? `<p>Groupe sanguin : ${esc(emergencyCard.bloodType)}</p>` : ''}${emergencyCard.allergies ? `<p>Allergies : ${esc(emergencyCard.allergies)}</p>` : ''}${emergencyCard.conditions ? `<p>Maladies connues : ${esc(emergencyCard.conditions)}</p>` : ''}` : ''}
<h2>Traitements en cours (prises des 30 derniers jours)</h2>${medRows ? `<table><tr><th>Médicament</th><th>Dose</th><th>Heures</th><th>Prises notées</th></tr>${medRows}</table>` : '<p>Aucun.</p>'}
${vitalBlocks ? `<h2>Dernières mesures</h2>${vitalBlocks}` : ''}
</body></html>`;
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Modal open onClose={onClose} title="Résumé pour le médecin" wide>
      <p className="text-sm text-mute mb-3">Tes traitements, comment ils ont été pris sur 30 jours, tes dernières mesures et tes allergies. « Imprimer » permet aussi d’enregistrer un PDF.</p>
      <div className="space-y-3 text-sm max-h-[55vh] overflow-y-auto">
        {data.meds.length ? data.meds.map(({ m, a, asNeeded }) => (
          <div key={m.id} className="flex justify-between gap-3 border-b border-line/60 pb-1.5">
            <span>{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
            <span className="font-data text-mute">{m.frequency === 'asNeeded' ? `${asNeeded} prise(s)` : a.pct == null ? '—' : `${a.pct} %`}</span>
          </div>
        )) : <p className="text-mute">Aucun traitement en cours.</p>}
        {data.byType.map(({ type, rows }) => (
          <div key={type}><span className="font-medium">{VITALS[type].label}</span> <span className="text-mute">: {rows.slice(0, 3).map((v) => vitalText(type, v)).join(' · ')} {VITALS[type].unit}</span></div>
        ))}
        {data.next.length > 0 && <div className="text-mute">Prochain rendez-vous : {fmtDate(data.next[0].date)} · {data.next[0].title}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
        <Button onClick={print}><span className="flex items-center gap-1.5"><Printer size={15} /> Imprimer ou PDF</span></Button>
      </div>
    </Modal>
  );
}
