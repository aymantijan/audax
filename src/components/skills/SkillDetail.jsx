import { useState } from 'react';
import { Lock, Award, Trash2, Sparkles, Clock } from 'lucide-react';
import { useSkillStore } from '../../store/skillStore';
import {
  FAMILY_MAP, MODEL_MAP, LEVELS, LEVEL_LABELS, PROOF_KINDS, UNLOCK_LEVEL, nextRequirementText,
} from '../../utils/skill-families';
import { fmtDate, todayKey } from '../../utils/formatters';
import { Badge, Button, Field, Input, Select, ProgressBar, IconButton } from '../common/ui';

const STATUS_TEXT = { locked: 'À découvrir', available: 'Disponible', active: 'En progression', mastered: 'Maîtrisée' };
const STATUS_COLOR = { locked: 'var(--text-secondary)', available: 'var(--accent-secondary)', active: 'var(--success)', mastered: 'var(--accent-primary)' };

const NO_PROOFS = [];
const daysSince = (ts) => (ts ? Math.floor((Date.now() - ts) / 86400000) : null);

function Requirement({ label, have, need }) {
  if (!need) return null;
  return (
    <div>
      <div className="flex justify-between text-xs text-mute mb-1">
        <span>{label}</span>
        <span className="font-data">{Math.min(have, need)}/{need}</span>
      </div>
      <ProgressBar value={Math.min(have, need)} max={need} height={6} />
    </div>
  );
}

// Everything about one compétence: level, what the next level needs, proofs,
// prerequisites, what it opens, and the latest activity that fed it.
export default function SkillDetail({ familyId, states, onNavigate }) {
  const addProof = useSkillStore((s) => s.addProof);
  const removeProof = useSkillStore((s) => s.removeProof);
  const proofs = useSkillStore((s) => s.proofs?.[familyId] || NO_PROOFS);
  const [form, setForm] = useState({ kind: 'exam', title: '', date: todayKey() });
  const fam = FAMILY_MAP[familyId];
  const st = states[familyId];
  if (!fam || !st) return null;
  const rule = LEVELS.find((r) => r.level === st.level + 1);
  const idle = daysSince(st.last);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    addProof(familyId, form);
    setForm({ kind: 'exam', title: '', date: todayKey() });
  };

  const linkBtn = (id) => (
    <button key={id} type="button" onClick={() => onNavigate(id)} className="flex items-center justify-between w-full text-left text-sm py-1 hover:text-accent cursor-pointer">
      <span className="truncate">{FAMILY_MAP[id]?.name}</span>
      <span className="text-xs font-data shrink-0 ml-2" style={{ color: STATUS_COLOR[states[id]?.status] }}>niv. {states[id]?.level ?? 0}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge color={STATUS_COLOR[st.status]}>{STATUS_TEXT[st.status]}</Badge>
          <Badge color="var(--accent-secondary)">{MODEL_MAP[fam.model]?.label} · {fam.branch}</Badge>
        </div>
        <p className="text-sm text-mute">{fam.desc}</p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-data">{st.level}</span>
        <span className="text-sm text-mute">/ 5 · {LEVEL_LABELS[st.level]}</span>
        <span className="ml-auto text-xs text-mute font-data">{st.points} pts · {st.activities} activité{st.activities > 1 ? 's' : ''}</span>
      </div>

      {st.status === 'locked' && (
        <div className="text-sm rounded-lg border border-line p-3 space-y-1">
          <div className="flex items-center gap-1.5 font-medium"><Lock size={14} /> Pour la découvrir</div>
          <p className="text-mute text-xs">Atteins le niveau {UNLOCK_LEVEL} en : {fam.prereqs.map((p) => FAMILY_MAP[p]?.name).join(', ')}. Tes activités liées à cette compétence comptent déjà.</p>
        </div>
      )}

      {st.capped && (
        <div className="text-sm rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
          <div className="flex items-center gap-1.5 font-medium"><Award size={14} /> Plafond atteint</div>
          <p className="text-xs mt-1">Tu as les points et les activités. Ajoute une preuve (examen, certificat, projet…) pour passer au niveau {st.level + 1}.</p>
        </div>
      )}

      {rule ? (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-mute uppercase tracking-wide">{nextRequirementText(st)}</div>
          <Requirement label="Points" have={st.points} need={rule.points} />
          <Requirement label="Activités séparées" have={st.activities} need={rule.activities} />
          <Requirement label="Preuves" have={st.proofCount} need={rule.proofs} />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--accent-primary)' }}><Sparkles size={14} /> Maîtrise complète — elle reste acquise.</div>
      )}

      {st.level > st.earned && st.level > 0 && (
        <p className="text-xs text-mute">Niveau {st.level} conservé : un niveau atteint ne se perd pas.</p>
      )}
      <p className="text-xs text-mute flex items-center gap-1.5">
        <Clock size={12} />
        {idle == null ? 'Pas encore pratiquée.' : idle === 0 ? 'Pratiquée aujourd’hui.' : `Dernière activité il y a ${idle} jour${idle > 1 ? 's' : ''}${idle > 90 ? ' — un petit rappel pour l’entretenir.' : '.'}`}
      </p>

      {fam.model === 'trading' && fam.stages.length > 1 && ( /* stage texts exist in English only */
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Le chemin</div>
          <ol className="text-xs text-mute space-y-1 list-decimal pl-4">
            {fam.stages.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Preuves</div>
        {proofs.length > 0 && (
          <ul className="space-y-1 mb-3">
            {proofs.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Award size={13} className="text-accent shrink-0" />
                <span className="truncate">{p.title}</span>
                <span className="text-xs text-mute shrink-0">{PROOF_KINDS.find((k) => k.id === p.kind)?.label} · {fmtDate(p.date)}</span>
                <IconButton label="Retirer la preuve" tone="danger" className="ml-auto" onClick={() => removeProof(familyId, p.id)}><Trash2 size={13} /></IconButton>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={PROOF_KINDS.map((k) => ({ value: k.id, label: k.label }))} /></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="Intitulé"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. Examen final réussi, 15/20" /></Field>
          <Button type="submit" variant="secondary" className="w-full" disabled={!form.title.trim()}>Ajouter la preuve</Button>
        </form>
      </div>

      {fam.prereqs.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Prérequis (niveau {UNLOCK_LEVEL})</div>
          <div className="divide-y divide-line/50">{fam.prereqs.map(linkBtn)}</div>
        </div>
      )}
      {fam.dependents.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1">Débloque</div>
          <div className="divide-y divide-line/50">{fam.dependents.map(linkBtn)}</div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Dernières activités</div>
        {st.recent.length ? (
          <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {st.recent.slice(0, 12).map((e, i) => (
              <li key={i} className="flex justify-between gap-2 text-mute">
                <span className="truncate">{e.source}</span>
                <span className="shrink-0 font-data text-good">+{e.amount} · {fmtDate(e.date)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mute">Rien pour l’instant. Relie-la à un cours, une habitude ou une lecture : chaque séance la fera grandir.</p>
        )}
      </div>
    </div>
  );
}
