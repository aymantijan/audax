import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLearningStore } from '../store/learningStore';
import { useReadingsStore } from '../store/readingsStore';
import { useSkillStore } from '../store/skillStore';
import { computeFamilyStates } from '../utils/skill-families';
import { useCreativeStore } from '../store/creativeStore';
import { useAccountingStore } from '../store/accountingStore';
import { fmtMAD, todayKey } from '../utils/formatters';
import { MODULES, isModuleEnabled, poleByKey, withModule } from '../utils/navigation';
import { toast } from '../store/uiStore';
import { useNavigate } from 'react-router-dom';
import { hasSampleFor, loadSample } from '../utils/sample-data';
import { Button, Card } from '../components/common/ui';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const month = () => todayKey().slice(0, 7);

// Key figure(s) per module — primitives only from each store (no fresh arrays
// in selectors), so the page never re-renders in a loop.
const SUMMARIES = {
  learning: function LearningSummary() {
    const active = useLearningStore((s) => s.courses.filter((c) => c.status === 'active').length);
    return { main: plural(active, 'cours en cours', 'cours en cours') };
  },
  readings: function ReadingsSummary() {
    const books = useReadingsStore((s) => s.library.length);
    return { main: plural(books, 'livre', 'livres'), sub: 'dans ta bibliothèque' };
  },
  skills: function SkillsSummary() {
    const skills = useSkillStore((s) => s.skills);
    const proofs = useSkillStore((s) => s.proofs);
    const mastery = useSkillStore((s) => s.mastery);
    const practised = useMemo(() => Object.values(computeFamilyStates({ skills, proofs, mastery })).filter((f) => f.level > 0).length, [skills, proofs, mastery]);
    return { main: plural(practised, 'compétence', 'compétences'), sub: 'pratiquées' };
  },
  creative: function CreativeSummary() {
    const works = useCreativeStore((s) => s.works.length);
    return { main: plural(works, 'œuvre', 'œuvres') };
  },
  finance: function FinanceSummary() {
    const net = useAccountingStore((s) => { try { return s.getNetWorth().ancc; } catch { return null; } });
    return { main: net == null ? '—' : fmtMAD(net), sub: 'patrimoine net', figure: true };
  },
};

function ModuleTile({ moduleKey }) {
  const m = MODULES[moduleKey];
  const useSummary = SUMMARIES[moduleKey];
  const summary = useSummary ? useSummary() : null;
  return (
    <Link to={m.to} className="group bg-card border border-line rounded-xl p-4 flex flex-col gap-3 hover:border-accent transition-colors">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><m.icon size={18} /></span>
        <span className="font-semibold">{m.label}</span>
        <ArrowRight size={15} className="ml-auto text-mute group-hover:text-accent transition-colors" />
      </div>
      {summary && (
        <div>
          <div className={`text-lg font-bold ${summary.figure ? 'font-data' : ''}`}>{summary.main}</div>
          {summary.sub && <div className="text-xs text-mute">{summary.sub}</div>}
        </div>
      )}
    </Link>
  );
}

// Home page of a section (/etudes): its pages with a
// key figure each, then the modules this person has not switched on yet.
export default function PoleHome({ poleKey }) {
  const pole = poleByKey(poleKey);
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const on = pole.modules.filter((k) => isModuleEnabled(user, k));
  const off = pole.modules.filter((k) => !isModuleEnabled(user, k));

  const enable = (k) => {
    updateProfile({ enabledModules: withModule(user, k, true) });
    toast(`${MODULES[k].label} est activé.`, 'success');
  };
  const tryWithSample = (k) => {
    updateProfile({ enabledModules: withModule(user, k, true) });
    loadSample(k);
    navigate(MODULES[k].to);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pole.label}</h1>
        <p className="text-mute text-sm mt-1">{pole.blurb}</p>
      </div>

      {on.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {on.map((k) => <ModuleTile key={k} moduleKey={k} />)}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-mute">Aucun module de cette section n’est activé pour l’instant. Choisis ceux qui te servent ci-dessous.</p>
        </Card>
      )}

      {off.length > 0 && (
        <Card title="Autres modules de cette section">
          <ul className="divide-y divide-line/60">
            {off.map((k) => {
              const m = MODULES[k];
              return (
                <li key={k} className="flex items-center gap-3 py-3">
                  <span className="w-9 h-9 rounded-lg bg-surface text-mute flex items-center justify-center shrink-0"><m.icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{m.label}</div>
                    {m.desc && <div className="text-xs text-mute">{m.desc}</div>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {hasSampleFor(k) && (
                      <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => tryWithSample(k)}>Essayer avec un exemple</Button>
                    )}
                    <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => enable(k)}>
                      <span className="flex items-center gap-1.5"><Plus size={13} /> Activer</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-mute mt-3">Tu peux les masquer à nouveau dans Paramètres → Sections visibles.</p>
        </Card>
      )}
    </div>
  );
}
