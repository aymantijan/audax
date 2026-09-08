import { AlertTriangle, Info, AlertCircle, X, CheckCheck } from 'lucide-react';
import { Button } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';

const SEVERITY_CONFIG = {
  info: { icon: Info, bg: 'bg-accent/5', border: 'border-accent/20', text: 'text-accent' },
  warning: { icon: AlertTriangle, bg: 'bg-warning/5', border: 'border-warning/20', text: 'text-warning' },
  critical: { icon: AlertCircle, bg: 'bg-bad/5', border: 'border-bad/20', text: 'text-bad' },
};

/**
 * Banner showing unacknowledged alerts at the top of the Programme view.
 */
export default function AlertsBanner() {
  const store = useProgramStore();
  const program = store.activeProgram;
  const { alerts } = store;

  if (!alerts.length || !program) return null;

  const handleDismiss = async (alertId) => {
    try {
      await store.acknowledgeAlert(alertId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissAll = async () => {
    try {
      await store.acknowledgeAllAlerts(program.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-2">
      {alerts.length > 1 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleDismissAll} className="!text-xs !py-1">
            <span className="flex items-center gap-1"><CheckCheck size={12} /> Tout acquitter</span>
          </Button>
        </div>
      )}
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
        const Icon = config.icon;
        return (
          <div
            key={alert.id}
            className={`${config.bg} border ${config.border} rounded-lg px-4 py-3 flex items-start gap-3`}
          >
            <Icon size={16} className={`${config.text} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${config.text}`}>{alert.title}</div>
              <p className="text-xs text-mute mt-0.5">{alert.message}</p>
              <span className="text-[9px] text-mute">
                {new Date(alert.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <button onClick={() => handleDismiss(alert.id)} className="text-mute hover:text-ink cursor-pointer flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
