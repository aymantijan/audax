import { useLocation } from 'react-router-dom';
import { FlaskRound } from 'lucide-react';
import { moduleOfPath, MODULES } from '../../utils/navigation';
import { clearSample, useSampleCount } from '../../utils/sample-data';
import { toast } from '../../store/uiStore';
import { Button } from '../common/ui';

// Shown on a module page while it holds example records.
export default function SampleBanner() {
  const location = useLocation();
  const module = moduleOfPath(location.pathname);
  const count = useSampleCount(module);
  if (!count) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/50 bg-warn/10 px-4 py-2.5">
        <FlaskRound size={16} className="text-warn shrink-0" />
        <p className="text-sm flex-1 min-w-[12rem]">
          {MODULES[module].label} contient {count} élément{count > 1 ? 's' : ''} d’exemple, pour voir à quoi ça ressemble. Tes vraies données ne sont pas touchées.
        </p>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => { clearSample(module); toast('Exemples supprimés.', 'success'); }}>
          Vider les exemples
        </Button>
      </div>
    </div>
  );
}
