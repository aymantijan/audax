import test from 'node:test';
import assert from 'node:assert/strict';
import { crossInsights, sleepByDay } from '../src/utils/cross-insights.js';

const day = (i) => `2026-09-${String(i).padStart(2, '0')}`;
const log = (i, start, wake) => ({ date: day(i), sleepData: { sleepStartTime: start, wakeTime: wake } });

test('needs 5 good and 5 short nights before saying anything', () => {
  const energyLogs = [1, 2, 3, 4].map((i) => log(i, '23:00', '07:00'));
  assert.deepEqual(crossInsights({ energyLogs, trades: energyLogs.map((l) => ({ date: l.date, pnl: 10 })) }), []);
});

test('compares trading and focus after good vs short nights', () => {
  const good = [1, 2, 3, 4, 5].map((i) => log(i, '23:00', '07:30'));
  const short = [6, 7, 8, 9, 10].map((i) => log(i, '01:30', '07:00'));
  const trades = [...good.map((l) => ({ date: l.date, pnl: 50 })), ...short.map((l) => ({ date: l.date, pnl: -20 }))];
  const sessions = [...good.map((l) => ({ date: l.date, durationMinutes: 90 })), ...short.map((l) => ({ date: l.date, durationMinutes: 30 }))];
  const res = crossInsights({ energyLogs: [...good, ...short], trades, sessions });
  const tr = res.find((r) => r.key === 'trading');
  assert.ok(tr.better);
  assert.match(tr.text, /50 par jour.*-20/);
  assert.match(res.find((r) => r.key === 'focus').text, /90 min.*30 min/);
  assert.equal(sleepByDay([log(1, '23:00', '07:30')])[day(1)], 8.5);
});
