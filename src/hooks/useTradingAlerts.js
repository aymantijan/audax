import { useEffect } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { computePropFirmProgress } from '../utils/prop-firm-analytics';
import { computePropFirmTimeline } from '../utils/account-type-analytics';
import { computeRiskLimitBreaches } from '../utils/risk-management';
import { detectTiltSequences } from '../utils/trading-psychology';
import { todayKey } from '../utils/formatters';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEADLINE_WARNING_DAYS = 3;

// Local-only reminders: no backend/push, so this only fires while the AUDAX
// tab is open (checked on an interval) — same limitation as useHealthReminders.
export function useTradingAlerts() {
  useEffect(() => {
    const check = () => {
      const { alerts, accounts, trades, markAlertShown } = useTradingStore.getState();
      if (!alerts.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const today = todayKey();
      const fire = (accountId, conditionKey, body) => {
        const key = `${accountId}|${conditionKey}`;
        if (alerts.lastShown[key] === today) return;
        new Notification('AUDAX Trading', { body });
        markAlertShown(key, today);
      };

      for (const account of accounts.filter((a) => a.status !== 'archived')) {
        const accountTrades = trades.filter((t) => (t.accountId || 'demo') === account.id);

        if (account.type === 'propfirm') {
          const progress = computePropFirmProgress(account, accountTrades);
          for (const breach of progress.breaches) {
            fire(account.id, `rule-${breach.rule}`, `${account.name}: ${breach.message}`);
          }
          const timeline = computePropFirmTimeline(account);
          if (timeline && !timeline.overdue && timeline.daysRemaining <= DEADLINE_WARNING_DAYS) {
            fire(account.id, 'deadline', `${account.name}: only ${timeline.daysRemaining} day(s) left in this phase (deadline ${timeline.deadline}).`);
          }
        } else {
          for (const breach of computeRiskLimitBreaches(account, accountTrades)) {
            fire(account.id, `risk-${breach.rule}`, `${account.name}: ${breach.message}`);
          }
        }

        const lastTiltSeq = detectTiltSequences(accountTrades).at(-1);
        if (lastTiltSeq && lastTiltSeq.nextTrade.date === today) {
          fire(account.id, 'tilt', `${account.name}: a ${lastTiltSeq.streakLength}-loss streak was followed by a sized-up trade today — possible tilt.`);
        }
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
