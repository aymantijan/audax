import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Boxes, List, Layers, Globe2, RotateCcw } from 'lucide-react';
import { useSkillStore } from '../store/skillStore';
import { useLearningStore } from '../store/learningStore';
import { useHabitStore } from '../store/habitStore';
import { useCareerStore } from '../store/careerStore';
import {
  computeFamilyStates, visibleFamilyIds, familyIdOf, FAMILY_MAP, MODELS, DEFAULT_MODELS,
} from '../utils/skill-families';
import { Stat, Button, Modal, Card } from '../components/common/ui';
import SkillList from '../components/skills/SkillList';
import SkillDetail from '../components/skills/SkillDetail';
import { SkillProfile, UpcomingTrials } from '../components/skills/SkillProfile';
import { useAllGoals } from '../hooks/useAllGoals';
import { lazyWithRetry } from '../utils/lazyRetry';

// three.js only loads when the 3D view is shown.
const SkillGalaxy = lazy(lazyWithRetry(() => import('../components/skills/SkillGalaxy'), 'SkillGalaxy'));

const SEEN_KEY = 'audax-skills-seen';
const VIEW_KEY = 'audax-skills-view';
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// The store as it was at `ts` — to replay what happened since the last visit.
function storeAt(store, ts) {
  const skills = {};
  for (const [id, s] of Object.entries(store.skills || {})) skills[id] = { ...s, xpLog: (s.xpLog || []).filter((e) => e.date <= ts) };
  const proofs = {};
  for (const [id, list] of Object.entries(store.proofs || {})) proofs[id] = (list || []).filter((p) => (p.createdAt || 0) <= ts);
  return { skills, proofs, mastery: {} };
}

function useWide() {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => window.matchMedia?.(q).matches ?? true);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

const LEGEND = [
  ['var(--accent-primary)', 'Maîtrisée'],
  ['var(--success)', 'En progression'],
  ['var(--accent-secondary)', 'Disponible'],
  ['var(--border)', 'À découvrir'],
  ['var(--warning)', 'Anneau : preuve attendue'],
];

export default function Skills() {
  const skills = useSkillStore((s) => s.skills);
  const proofs = useSkillStore((s) => s.proofs);
  const mastery = useSkillStore((s) => s.mastery);
  const activeModels = useSkillStore((s) => s.activeModels) || DEFAULT_MODELS;
  const toggleModel = useSkillStore((s) => s.toggleModel);
  const lifetime = useSkillStore((s) => s.getLifetimeXP());
  const courses = useLearningStore((s) => s.courses);
  const habits = useHabitStore((s) => s.habits);
  const plans = useCareerStore((s) => s.plans);

  const goals = useAllGoals();
  const wide = useWide();
  const galaxyRef = useRef(null);
  const [view, setView] = useState(() => read(VIEW_KEY) || '3d');
  const [unsupported, setUnsupported] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [modelsOpen, setModelsOpen] = useState(false);

  const states = useMemo(() => computeFamilyStates({ skills, proofs, mastery }), [skills, proofs, mastery]);

  const linked = useMemo(() => {
    const ids = new Set();
    for (const c of courses || []) for (const id of c.linkedSkills || []) ids.add(familyIdOf(id));
    for (const h of habits || []) if (h.linkedSkill) ids.add(familyIdOf(h.linkedSkill));
    for (const p of plans || []) for (const s of p.skills || []) if (s.skillId) ids.add(familyIdOf(s.skillId));
    return ids;
  }, [courses, habits, plans]);

  const visibleKey = visibleFamilyIds(states, activeModels, linked).join('|');
  const visibleIds = useMemo(() => (visibleKey ? visibleKey.split('|') : []), [visibleKey]);

  // What happened since the last visit (replayed in 3D once, summarised here).
  const [since] = useState(() => {
    const ts = Number(read(SEEN_KEY)) || 0;
    if (!ts) return null;
    return computeFamilyStates(storeAt(useSkillStore.getState(), ts));
  });
  useEffect(() => { write(SEEN_KEY, String(Date.now())); }, []);
  const recap = useMemo(() => {
    if (!since) return null;
    let points = 0, levels = 0, unlocks = 0;
    for (const id of visibleIds) {
      const a = since[id]; const b = states[id];
      if (!a || !b) continue;
      points += Math.max(0, b.points - a.points);
      levels += Math.max(0, b.level - a.level);
      if (!a.available && b.available && FAMILY_MAP[id].prereqs.length) unlocks++;
    }
    return points || levels || unlocks ? { points, levels, unlocks } : null;
  }, [since]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = visibleIds.map((id) => states[id]);
  const practised = list.filter((s) => s.level > 0).length;
  const masteredN = list.filter((s) => s.status === 'mastered').length;
  const proofN = Object.values(proofs || {}).reduce((a, l) => a + (l?.length || 0), 0);
  const cappedN = list.filter((s) => s.capped).length;

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || view !== '3d') return [];
    return visibleIds.map((id) => FAMILY_MAP[id]).filter((f) => f.name.toLowerCase().includes(q) || f.branch.toLowerCase().includes(q)).slice(0, 8);
  }, [search, visibleIds, view]);

  const is3d = view === '3d' && !unsupported;
  const open = (id, fly = true) => {
    setSelected(id);
    setSearch('');
    if (fly && is3d) galaxyRef.current?.flyTo({ node: id });
  };
  const showModel = (modelId) => {
    if (is3d) {
      galaxyRef.current?.flyTo({ cluster: modelId });
      document.querySelector('.sg-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else document.getElementById(`skills-model-${modelId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const setViewKept = (v) => { setView(v); write(VIEW_KEY, v); };
  const shownModels = MODELS.filter((m) => visibleIds.some((id) => FAMILY_MAP[id].model === m.id));

  const detail = selected && <SkillDetail familyId={selected} states={states} onNavigate={(id) => open(id)} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Compétences</h1>
        <p className="text-mute text-sm mt-1">
          Chaque cours, habitude, lecture ou séance nourrit tes compétences. Un niveau demande des points et des activités régulières ; varier les sources rapporte plus ; les niveaux 4 et 5 demandent une preuve. Un niveau atteint reste acquis.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Compétences pratiquées" value={practised} sub={`sur ${visibleIds.length} affichées`} />
        <Stat label="Maîtrisées" value={masteredN} />
        <Stat label="Preuves" value={proofN} sub={cappedN ? `${cappedN} en attente d’une preuve` : undefined} />
        <Stat label="Points au total" value={lifetime} />
      </div>

      <SkillProfile states={states} visibleIds={visibleIds} onModel={showModel} />

      <UpcomingTrials goals={goals} states={states} onSkill={(id) => open(id)} />

      {recap && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm">
          <span>
            Depuis ta dernière visite : <b className="font-data">+{recap.points}</b> points
            {recap.levels > 0 && <> · <b className="font-data">{recap.levels}</b> niveau{recap.levels > 1 ? 'x' : ''} gagné{recap.levels > 1 ? 's' : ''}</>}
            {recap.unlocks > 0 && <> · <b className="font-data">{recap.unlocks}</b> compétence{recap.unlocks > 1 ? 's' : ''} débloquée{recap.unlocks > 1 ? 's' : ''}</>}
          </span>
          {is3d && (
            <Button variant="ghost" className="ml-auto !px-2" onClick={() => galaxyRef.current?.replay(since)}>
              <span className="flex items-center gap-1.5"><RotateCcw size={14} /> Revoir</span>
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input
            className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-accent"
            placeholder="Chercher une compétence…" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) open(results[0].id); }}
          />
          {results.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-line rounded-lg shadow-xl divide-y divide-line/50 overflow-hidden">
              {results.map((f) => (
                <button key={f.id} type="button" onClick={() => open(f.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface cursor-pointer flex justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-mute shrink-0">niv. {states[f.id].level}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={() => setModelsOpen(true)}>
          <span className="flex items-center gap-1.5"><Layers size={14} /> Modèles</span>
        </Button>
        {!unsupported && (
          <div className="flex rounded-lg border border-line overflow-hidden" role="group" aria-label="Affichage">
            <button type="button" onClick={() => setViewKept('3d')} className={`px-3 py-2 text-sm flex items-center gap-1.5 cursor-pointer ${is3d ? 'bg-accent text-on-accent' : 'text-mute hover:text-ink'}`}><Boxes size={14} /> 3D</button>
            <button type="button" onClick={() => setViewKept('list')} className={`px-3 py-2 text-sm flex items-center gap-1.5 cursor-pointer ${!is3d ? 'bg-accent text-on-accent' : 'text-mute hover:text-ink'}`}><List size={14} /> Liste</button>
          </div>
        )}
      </div>

      {is3d && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => galaxyRef.current?.flyTo('overview')} className="px-2.5 py-1 rounded-full text-xs border border-line text-mute hover:text-ink hover:border-accent cursor-pointer flex items-center gap-1"><Globe2 size={12} /> Vue d’ensemble</button>
          {shownModels.map((m) => (
            <button key={m.id} type="button" onClick={() => galaxyRef.current?.flyTo({ cluster: m.id })} className="px-2.5 py-1 rounded-full text-xs border border-line text-mute hover:text-accent hover:border-accent cursor-pointer">{m.label}</button>
          ))}
        </div>
      )}

      <div className={wide && selected ? 'grid grid-cols-[1fr_380px] gap-4 items-start' : ''}>
        <div className="min-w-0">
          {is3d ? (
            <>
              <Suspense fallback={<div className="rounded-xl border border-line bg-card flex items-center justify-center text-sm text-mute" style={{ height: 'min(72vh, 720px)', minHeight: 420 }}>Chargement de la vue 3D…</div>}>
                <SkillGalaxy ref={galaxyRef} states={states} visibleIds={visibleIds} since={since} onSelect={(id) => open(id, false)} onUnsupported={() => setUnsupported(true)} />
              </Suspense>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-mute">
                {LEGEND.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /> {l}</span>)}
                <span className="sm:ml-auto">Glisse pour tourner · pince ou molette pour zoomer · touche une sphère</span>
              </div>
            </>
          ) : (
            <Card><SkillList states={states} visibleIds={visibleIds} query={search} onSelect={(id) => open(id, false)} /></Card>
          )}
        </div>
        {wide && selected && (
          <Card title={FAMILY_MAP[selected]?.name} action={<Button variant="ghost" className="!px-2" onClick={() => setSelected(null)}>Fermer</Button>}>
            <div className="max-h-[70vh] overflow-y-auto pr-1">{detail}</div>
          </Card>
        )}
      </div>

      {!wide && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={FAMILY_MAP[selected]?.name || ''}>{detail}</Modal>
      )}

      <Modal open={modelsOpen} onClose={() => setModelsOpen(false)} title="Modèles affichés">
        <p className="text-sm text-mute mb-4">Choisis les domaines qui te concernent. Les compétences que tu as déjà pratiquées, ou reliées à un cours, une habitude ou un plan de carrière, restent toujours visibles.</p>
        <div className="space-y-1">
          {MODELS.map((m) => {
            const on = activeModels.includes(m.id);
            return (
              <label key={m.id} className="flex items-center gap-3 py-2 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggleModel(m.id)} className="accent-[var(--accent-primary)] w-4 h-4" />
                <span className="flex-1">
                  <span className="block text-sm">{m.label}</span>
                  <span className="block text-xs text-mute">{m.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
