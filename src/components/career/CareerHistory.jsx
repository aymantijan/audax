import { useMemo, useState } from 'react';
import { Briefcase, GraduationCap, Award, Send, Users, Megaphone, Flag } from 'lucide-react';
import { useCareerStore } from '../../store/careerStore';
import { useNetworkingStore } from '../../store/networkingStore';
import { useContentStore } from '../../store/contentStore';
import { stageLabel } from '../../utils/constants';
import { fmtDate } from '../../utils/formatters';
import { fmtMonth } from '../../utils/cv-pdf';
import { Card, EmptyState } from '../common/ui';

const KINDS = {
  experience: { label: 'Expériences', icon: Briefcase, color: 'var(--accent-primary)' },
  education: { label: 'Formation', icon: GraduationCap, color: '#a78bfa' },
  certification: { label: 'Certifications', icon: Award, color: '#f59e0b' },
  application: { label: 'Candidatures', icon: Send, color: '#60a5fa' },
  network: { label: 'Réseau', icon: Users, color: '#10b981' },
  content: { label: 'Visibilité', icon: Megaphone, color: '#f472b6' },
};
const STAGE_TEXT = { Applied: 'Candidature envoyée', Screening: 'Présélection', Interview: 'Entretien', Offer: 'Offre reçue', Accepted: 'Offre acceptée', Rejected: 'Candidature refusée', Withdrawn: 'Candidature retirée' };
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * The whole career story on one timeline: parcours (experiences, education,
 * certifications from the profile) + activity (application stages, contacts
 * and exchanges, published posts). Newest first, grouped by month.
 */
export default function CareerHistory() {
  const profile = useCareerStore((s) => s.profile);
  const applications = useCareerStore((s) => s.applications);
  const contacts = useNetworkingStore((s) => s.contacts);
  const posts = useContentStore((s) => s.posts);
  const [hidden, setHidden] = useState([]);

  const events = useMemo(() => {
    const out = [];
    const day = (ym) => (String(ym || '').length === 7 ? `${ym}-01` : ym);
    for (const x of profile.experiences || []) {
      if (x.start) out.push({ kind: 'experience', month: true, date: day(x.start), title: `Début — ${x.title}`, sub: [x.org, x.type].filter(Boolean).join(' · '), milestone: true });
      if (x.end && !x.current) out.push({ kind: 'experience', month: true, date: day(x.end), title: `Fin — ${x.title}`, sub: x.org });
    }
    for (const x of profile.education || []) {
      if (x.start) out.push({ kind: 'education', month: true, date: day(x.start), title: `Rentrée — ${x.degree}`, sub: [x.school, x.field].filter(Boolean).join(' · '), milestone: true });
      if (x.end && !x.current) out.push({ kind: 'education', month: true, date: day(x.end), title: `Diplômé — ${x.degree}`, sub: x.school, milestone: true });
    }
    for (const x of profile.certifications || []) if (x.date) out.push({ kind: 'certification', month: true, date: day(x.date), title: `Certification — ${x.name}`, sub: x.issuer, milestone: true });
    for (const a of applications) {
      for (const h of a.stageHistory?.length ? a.stageHistory : [{ stage: 'Applied', date: a.appliedDate }]) {
        const date = h.stage === 'Applied' ? a.appliedDate || h.date : h.date;
        out.push({ kind: 'application', date, title: `${STAGE_TEXT[h.stage] || stageLabel(h.stage)} — ${a.role}`, sub: a.company, milestone: h.stage === 'Offer' || h.stage === 'Accepted' });
      }
    }
    for (const c of contacts) {
      if (c.createdAt) out.push({ kind: 'network', date: new Date(c.createdAt).toLocaleDateString('sv-SE'), title: `Nouveau contact — ${c.name}`, sub: [c.role, c.org].filter(Boolean).join(' · ') });
      for (const t of c.touches || []) out.push({ kind: 'network', date: t.date, title: `${t.type || 'Échange'} avec ${c.name}`, sub: t.note || c.org || '' });
    }
    for (const p of posts) if (p.publishedDate && p.status === 'Publié') out.push({ kind: 'content', date: p.publishedDate, title: `Publication ${p.platform} — ${p.title}`, sub: [p.likes ? `${p.likes} likes` : '', p.views ? `${p.views} vues` : ''].filter(Boolean).join(' · ') });
    return out.filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [profile, applications, contacts, posts]);

  const shown = events.filter((e) => !hidden.includes(e.kind));
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of shown) { const k = e.date.slice(0, 7); if (!map.has(k)) map.set(k, []); map.get(k).push(e); }
    return [...map.entries()];
  }, [shown]);
  const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, events.filter((e) => e.kind === k).length]));

  return (
    <Card title="Historique de carrière">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(KINDS).map(([k, def]) => {
          const on = !hidden.includes(k);
          const Icon = def.icon;
          return (
            <button key={k} onClick={() => setHidden((h) => (on ? [...h, k] : h.filter((x) => x !== k)))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${on ? 'border-line text-ink' : 'border-line/50 text-mute opacity-50'}`}>
              <Icon size={12} style={{ color: def.color }} /> {def.label} <span className="text-mute">{counts[k]}</span>
            </button>
          );
        })}
      </div>
      {groups.length ? (
        <div className="space-y-5">
          {groups.map(([ym, list]) => (
            <div key={ym}>
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-2">{MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} {ym.slice(0, 4)}</div>
              <ol className="relative border-l border-line ml-2 space-y-3">
                {list.map((e, i) => {
                  const def = KINDS[e.kind];
                  const Icon = e.milestone ? Flag : def.icon;
                  return (
                    <li key={`${e.kind}-${e.date}-${i}`} className="ml-4 relative">
                      <span className="absolute -left-[25px] top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-card border" style={{ borderColor: def.color }}>
                        <Icon size={10} style={{ color: def.color }} />
                      </span>
                      <div className={`text-sm ${e.milestone ? 'font-semibold' : ''}`}>{e.title}</div>
                      <div className="text-xs text-mute">{[e.month ? fmtMonth(e.date) : fmtDate(e.date), e.sub].filter(Boolean).join(' · ')}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>Votre historique se construit tout seul : ajoutez votre parcours dans « Profil », vos candidatures, vos contacts et vos publications.</EmptyState>
      )}
      <p className="text-[11px] text-mute mt-4">Les jalons (rentrée, diplôme, offre, certification…) sont en gras. Le parcours est daté au mois.</p>
    </Card>
  );
}
