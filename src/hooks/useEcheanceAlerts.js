import { useEffect } from 'react';
import { useAccountingStore } from '../store/accountingStore';
import { todayKey } from '../utils/formatters';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Local-only reminders: no backend/push, so this only fires while the AUDAX
// tab is open (checked on an interval) — same limitation as useHealthReminders
// / useTradingAlerts. One notification per occurrence per day (deduped via
// lastShown, keyed by échéance id + occurrence date) so it doesn't re-fire on
// every interval tick while an échéance stays unpaid.
export function useEcheanceAlerts() {
  useEffect(() => {
    const check = () => {
      const { echeanceAlerts, getOverdueEcheances, markEcheanceAlertShown } = useAccountingStore.getState();
      if (!echeanceAlerts.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const today = todayKey();
      const overdue = getOverdueEcheances();
      if (!overdue.length) return;

      for (const row of overdue) {
        const key = `${row.id}|${row.occurrenceDate}`;
        if (echeanceAlerts.lastShown[key] === today) continue;
        new Notification('AUDAX Finance', { body: `Échéance en retard : ${row.label} (${row.occurrenceDate}) — ${row.amount} DH.` });
        markEcheanceAlertShown(key, today);
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
