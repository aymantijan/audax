import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useHabitStore } from '../../store/habitStore';
import { useAccountingStore } from '../../store/accountingStore';
import { useHealthStore } from '../../store/healthStore';
import { useReadingsStore } from '../../store/readingsStore';
import { useTradingStore } from '../../store/tradingStore';
import { useCareerStore } from '../../store/careerStore';
import { useNetworkingStore } from '../../store/networkingStore';
import { useContentStore } from '../../store/contentStore';
import { useFocusStore } from '../../store/focusStore';
import { useFreelanceStore } from '../../store/freelanceStore';
import { useDealsStore } from '../../store/dealsStore';
import { useBusinessStore } from '../../store/businessStore';
import { useEngineeringStore } from '../../store/engineeringStore';
import { useFundraisingStore } from '../../store/fundraisingStore';
import { useCreativeStore } from '../../store/creativeStore';
import { useRealEstateStore } from '../../store/realEstateStore';
import { moduleNudges } from '../../utils/module-nudges';
import { MODULES, withModule } from '../../utils/navigation';
import { toast } from '../../store/uiStore';
import { Button } from '../common/ui';

// One suggestion at a time, dismissible for good.
export default function NudgeCard() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const habits = useHabitStore((s) => s.habits);
  const counts = {
    journal: useAccountingStore((s) => s.journal.length),
    workouts: useHealthStore((s) => s.workouts.length),
    library: useReadingsStore((s) => s.progress.length),
    trades: useTradingStore((s) => s.trades.length),
    applications: useCareerStore((s) => s.applications.length),
    contacts: useNetworkingStore((s) => s.contacts.length),
    posts: useContentStore((s) => s.posts.length),
    sessions: useFocusStore((s) => s.sessions.length),
    engagements: useFreelanceStore((s) => s.engagements.length),
    deals: useDealsStore((s) => s.deals.length),
    businesses: useBusinessStore((s) => s.businesses.length),
    engProjects: useEngineeringStore((s) => s.projects.length),
    labEntries: useEngineeringStore((s) => s.labEntries.length),
    investors: useFundraisingStore((s) => s.investors.length),
    works: useCreativeStore((s) => s.works.length),
    properties: useRealEstateStore((s) => s.properties.length),
  };
  const key = JSON.stringify(counts);
  const nudge = useMemo(
    () => moduleNudges({ user, counts, habitNames: habits.filter((h) => !h.archived).map((h) => h.name) })[0] || null,
    [user, key, habits], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!nudge) return null;

  const dismiss = () => updateProfile({ dismissedNudges: [...(user?.dismissedNudges || []), nudge.id] });
  const act = () => {
    const a = nudge.action;
    if (a.type === 'enable') {
      updateProfile({ enabledModules: withModule(user, a.module, true), dismissedNudges: [...(user?.dismissedNudges || []), nudge.id] });
      toast(`${MODULES[a.module].label} est activé.`, 'success');
      navigate(MODULES[a.module].to);
    } else if (a.type === 'hide') {
      updateProfile({ enabledModules: withModule(user, a.module, false), dismissedNudges: [...(user?.dismissedNudges || []), nudge.id] });
      toast(`${MODULES[a.module].label} est masqué. Tu peux le réactiver dans Paramètres.`, 'success');
    } else {
      dismiss();
      navigate(a.to);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
      <Lightbulb size={18} className="text-accent shrink-0" />
      <p className="text-sm flex-1 min-w-[12rem]">{nudge.text}</p>
      <div className="flex items-center gap-2">
        <Button className="!px-3 !py-1.5 text-xs" onClick={act}>{nudge.action.label}</Button>
        <button type="button" onClick={dismiss} aria-label="Ne plus proposer" title="Ne plus proposer" className="ui-icon-btn p-1.5 rounded-lg text-mute hover:text-ink cursor-pointer flex items-center justify-center"><X size={16} /></button>
      </div>
    </div>
  );
}
