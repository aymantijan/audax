import { useEffect } from 'react';
import { useAccountingStore } from '../store/accountingStore';
import { todayKey } from '../utils/formatters';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Local-only reminders: no backend/push, so this only fires while the AUDAX
// tab is open (checked on an interval) — same limitation as useHealthReminders
// / useTradingAlerts / useEcheanceAlerts. Key includes the month ('YYYY-MM')
// so a new month's overrun fires fresh even if the account was over-budget and
// dismissed last month; within a month it still fires at most once per day.
export function useBudgetAlerts() {
  useEffect(() => {
    const check = () => {
      const { budgetAlerts, getBudgetAlerts, markBudgetAlertShown } = useAccountingStore.getState();
      if (!budgetAlerts.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const today = todayKey();
      const mk = today.slice(0, 7);
      for (const row of getBudgetAlerts()) {
        const key = `${row.account}|${mk}`;
        if (budgetAlerts.lastShown[key] === today) continue;
        new Notification('AUDAX Finance', { body: `Budget dépassé : ${row.label} — ${row.reel} DH / ${row.amount} DH (+${Math.round(row.severity.over)}%).` });
        markBudgetAlertShown(key, today);
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
