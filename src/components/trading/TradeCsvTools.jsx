import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useTradingStore } from '../../store/tradingStore';
import { toCSV, parseCSV, downloadCSV } from '../../utils/csv';
import { tradeSchema, validate } from '../../utils/validators';
import { INSTRUMENTS, STRATEGIES, EMOTIONS } from '../../utils/constants';
import { Button } from '../common/ui';
import { toast } from '../../store/uiStore';

// Flat CSV shape (one row per trade) — export writes every column, import
// reads them back by header name (order-independent, extra columns ignored).
const COLUMNS = [
  { key: 'date', label: 'date', get: (t) => t.date },
  { key: 'instrument', label: 'instrument', get: (t) => t.instrument },
  { key: 'strategy', label: 'strategy', get: (t) => t.strategy },
  { key: 'direction', label: 'direction', get: (t) => t.direction },
  { key: 'entryPrice', label: 'entryPrice', get: (t) => t.entryPrice },
  { key: 'exitPrice', label: 'exitPrice', get: (t) => t.exitPrice },
  { key: 'stopLoss', label: 'stopLoss', get: (t) => t.stopLoss },
  { key: 'takeProfit', label: 'takeProfit', get: (t) => t.takeProfit },
  { key: 'positionSize', label: 'positionSize', get: (t) => t.positionSize },
  { key: 'riskAmount', label: 'riskAmount', get: (t) => t.riskAmount },
  { key: 'pnl', label: 'pnl', get: (t) => t.pnl },
  { key: 'pnlPips', label: 'pnlPips', get: (t) => t.pnlPips },
  { key: 'fees', label: 'fees', get: (t) => t.fees },
  { key: 'holdingTime', label: 'holdingTime', get: (t) => t.holdingTime },
  { key: 'emotion', label: 'emotion', get: (t) => t.journal?.emotion },
  { key: 'processQuality', label: 'processQuality', get: (t) => t.journal?.processQuality },
  { key: 'reasoning', label: 'reasoning', get: (t) => t.journal?.reasoning },
  { key: 'exitReason', label: 'exitReason', get: (t) => t.journal?.exitReason },
  { key: 'lesson', label: 'lesson', get: (t) => t.lesson },
];

function rowToTradeData(row) {
  return {
    date: row.date?.trim(),
    instrument: row.instrument?.trim(),
    strategy: row.strategy?.trim(),
    direction: row.direction?.trim().toLowerCase(),
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    stopLoss: row.stopLoss || undefined,
    takeProfit: row.takeProfit || undefined,
    positionSize: row.positionSize,
    riskAmount: row.riskAmount || 0,
    pnl: row.pnl,
    fees: row.fees || undefined,
    holdingTime: row.holdingTime || 0,
    journal: {
      reasoning: row.reasoning || '',
      emotion: EMOTIONS.includes(row.emotion) ? row.emotion : 'neutral',
      processQuality: row.processQuality || 5,
      exitReason: row.exitReason || '',
    },
    lesson: row.lesson || '',
    linkedSkills: [],
    macro: {},
  };
}

export default function TradeCsvTools({ trades, accountName }) {
  const { addTrade, customInstruments, customStrategies } = useTradingStore();
  const fileRef = useRef(null);
  const [result, setResult] = useState(null); // { imported, errors: [{row, message}] }

  const exportCsv = () => {
    if (!trades.length) return toast('No trades to export.', 'info');
    const csv = toCSV(trades, COLUMNS);
    downloadCSV(`audax-trades-${(accountName || 'account').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(`Exported ${trades.length} trade${trades.length > 1 ? 's' : ''}`, 'success');
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const knownInstruments = new Set([...INSTRUMENTS, ...customInstruments.map((c) => c.code)]);
    const knownStrategies = new Set([...STRATEGIES, ...customStrategies.map((c) => c.name)]);

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result));
      let imported = 0;
      const errors = [];
      rows.forEach((row, i) => {
        const data = rowToTradeData(row);
        if (data.instrument && !knownInstruments.has(data.instrument)) {
          errors.push({ row: i + 2, message: `Unknown instrument "${data.instrument}" — add it first via Customize instruments & strategies.` });
          return;
        }
        if (data.strategy && !knownStrategies.has(data.strategy)) {
          errors.push({ row: i + 2, message: `Unknown strategy "${data.strategy}" — add it first via Customize instruments & strategies.` });
          return;
        }
        const res = validate(tradeSchema, data);
        if (!res.ok) {
          errors.push({ row: i + 2, message: res.error });
          return;
        }
        addTrade({ ...res.data, macro: {} });
        imported++;
      });
      setResult({ imported, errors });
      toast(`Imported ${imported} trade${imported === 1 ? '' : 's'}${errors.length ? `, ${errors.length} skipped` : ''}`, errors.length ? 'warning' : 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={exportCsv}>
          <span className="flex items-center gap-2"><Download size={13} /> Export CSV</span>
        </Button>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
          <span className="flex items-center gap-2"><Upload size={13} /> Import CSV</span>
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
      </div>
      {result?.errors.length > 0 && (
        <div className="text-[11px] text-mute max-h-24 overflow-y-auto border border-line rounded-lg p-2 space-y-0.5">
          {result.errors.slice(0, 20).map((e, i) => (
            <div key={i} className="text-bad">Row {e.row}: {e.message}</div>
          ))}
          {result.errors.length > 20 && <div>…and {result.errors.length - 20} more.</div>}
        </div>
      )}
    </div>
  );
}
