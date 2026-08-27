// Elegant, presentable trading account report — a PDF export, added
// 2026-08-27, closing the one real gap found auditing Trading against the
// rest of the app: every other domain (Business, Engineering, Deals) had a
// polished PDF export; Trading only had raw CSV. Deliberately NOT a screenshot
// attachment (that idea was considered and rejected — same localStorage-bloat
// reasoning already established for Health's progress photos, worse here
// since a trader logs far more entries than a dieter takes photos).
//
// Cover page: gradient banner, account value + signed P&L, a hand-drawn
// score badge, a stat grid, a hand-drawn equity curve (filled area + stroke,
// no charting library — same "two triangles = a filled quad" trick already
// used for PDF diamonds elsewhere in this codebase), a discipline breakdown,
// and — only for prop-firm accounts — a rules-progress section. Then a
// portrait trade-journal table, paginated, banner + footer repeated per page.
//
// Pure presentation over data these selectors ALREADY compute (tradeStats,
// equityCurve, maxDrawdown, computeAccountScore, computeDisciplineScore,
// computePropFirmProgress) — no new math invented here.
import { tradeStats, equityCurve, maxDrawdown } from './calculations';
import { computeAccountScore } from './trading-score';
import { computeDisciplineScore } from './trading-psychology';
import { computePropFirmProgress } from './prop-firm-analytics';
import { CURRENCY_SYMBOL } from './constants';

const NAVY = [12, 18, 38];
const CYAN = [0, 209, 255];
const CYAN_DARK = [0, 140, 179];
const INK = [26, 30, 40];
const MUTE = [120, 128, 140];
const GRID = [224, 228, 233];
const GOOD = [22, 163, 116];
const BAD = [220, 68, 68];
const WARN = [217, 150, 30];

const bandColor = (band) => (band?.label === 'Strong' ? GOOD : band?.label === 'Developing' ? WARN : BAD);

function money(n, currency, digits = 0) {
  const sym = CURRENCY_SYMBOL[currency] || currency || '$';
  const s = Math.abs(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
  return `${n < 0 ? '-' : ''}${sym}${s}`;
}
function signedMoney(n, currency) {
  const sym = CURRENCY_SYMBOL[currency] || currency || '$';
  return `${n >= 0 ? '+' : '-'}${sym}${Math.abs(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

// A left-to-right color-interpolated banner — jsPDF has no native gradient
// fill, so this paints N thin vertical strips, each one step closer to the
// end color, which reads as a smooth gradient at print resolution.
function gradientBar(doc, x, y, w, h, from, to, steps = 48) {
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepW, y, stepW + 0.5, h, 'F');
  }
}

// A filled area under a curve, built from consecutive two-triangle quads
// (jsPDF's `triangle` is a documented primitive; there's no native polygon
// fill worth reaching for two triangles' worth of geometry) plus a crisp
// stroked line on top.
function drawCurve(doc, points, box, { fillTop, fillBottom, stroke, baselineY }) {
  const { x, y, w, h } = box;
  if (points.length < 2) return;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, baselineY ?? Infinity);
  const max = Math.max(...values, baselineY ?? -Infinity);
  const span = max - min || 1;
  const xFor = (i) => x + (i / (points.length - 1)) * w;
  const yFor = (v) => y + h - ((v - min) / span) * h;

  for (let i = 0; i < points.length - 1; i++) {
    const x1 = xFor(i), x2 = xFor(i + 1);
    const y1 = yFor(points[i].value), y2 = yFor(points[i + 1].value);
    const yBase = y + h;
    const t = i / (points.length - 2 || 1);
    const fr = Math.round(fillTop[0] + (fillBottom[0] - fillTop[0]) * t);
    const fg = Math.round(fillTop[1] + (fillBottom[1] - fillTop[1]) * t);
    const fb = Math.round(fillTop[2] + (fillBottom[2] - fillTop[2]) * t);
    doc.setFillColor(fr, fg, fb);
    doc.triangle(x1, yBase, x1, y1, x2, y2, 'F');
    doc.triangle(x1, yBase, x2, y2, x2, yBase, 'F');
  }
  doc.setDrawColor(...stroke);
  doc.setLineWidth(0.7);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(xFor(i), yFor(points[i].value), xFor(i + 1), yFor(points[i + 1].value));
  }
  if (baselineY != null) {
    doc.setDrawColor(...MUTE);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(x, yFor(baselineY), x + w, yFor(baselineY));
    doc.setLineDashPattern([], 0);
  }
  return { min, max, xFor, yFor };
}

function progressBar(doc, x, y, w, pct, color) {
  doc.setFillColor(...GRID);
  doc.roundedRect(x, y, w, 2.4, 1.2, 1.2, 'F');
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(2, (w * clamped) / 100), 2.4, 1.2, 1.2, 'F');
  }
}

export async function exportTradingReportPDF(account, trades) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 16, marginR = 16;
  const contentW = pageW - marginL - marginR;
  const currency = account.currency || 'USD';
  const initial = account.initialBalance || 0;
  const curve = equityCurve(trades, initial);
  const stats = tradeStats(trades);
  const dd = maxDrawdown(curve);
  const score = computeAccountScore(trades, initial);
  const disc = trades.length ? computeDisciplineScore(trades) : null;
  const value = initial + stats.totalPnl;
  const isPropFirm = account.type === 'propfirm';
  const propProgress = isPropFirm ? computePropFirmProgress(account, trades) : null;
  const fileBase = account.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // ── Cover banner ──
  gradientBar(doc, 0, 0, pageW, 40, NAVY, CYAN_DARK);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(20);
  doc.text(account.name, marginL, 20);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  const typeLabel = { demo: 'Demo', broker: 'Broker', propfirm: 'Prop Firm' }[account.type] || account.type;
  doc.text(`${typeLabel} · ${currency}${account.status ? ` · ${account.status}` : ''}`, marginL, 28);
  doc.setFontSize(8);
  doc.text(`Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW - marginR, 20, { align: 'right' });
  doc.text(`${trades.length} trade${trades.length !== 1 ? 's' : ''}`, pageW - marginR, 26, { align: 'right' });
  doc.setTextColor(0);

  let y = 52;

  // ── Value + score badge ──
  doc.setFontSize(9);
  doc.setTextColor(...MUTE);
  doc.text('VALEUR DU COMPTE', marginL, y);
  doc.setTextColor(...INK);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(24);
  doc.text(money(value, currency), marginL, y + 10);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...(stats.totalPnl >= 0 ? GOOD : BAD));
  doc.text(`${signedMoney(stats.totalPnl, currency)} depuis le solde initial`, marginL, y + 17);
  doc.setTextColor(0);

  if (!score.insufficientData) {
    const cx = pageW - marginR - 16, cy = y + 5, r = 13;
    const sc = bandColor(score.band);
    doc.setDrawColor(...sc);
    doc.setLineWidth(1.6);
    doc.circle(cx, cy, r, 'S');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...sc);
    doc.text(String(score.score), cx, cy + 2, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTE);
    doc.text('SCORE', cx, cy + 7, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(...sc);
    doc.text(score.band.label, cx, cy + r + 6, { align: 'center' });
    doc.setTextColor(0);
  }

  y += 26;

  // ── Stat grid ──
  const stat = (label, val, x, color) => {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTE);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...(color || INK));
    doc.text(val, x, y + 6.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
  };
  const colW = contentW / 4;
  stat('Trades', String(stats.count), marginL);
  stat('Taux de réussite', `${stats.winRate.toFixed(1)}%`, marginL + colW);
  stat('Profit factor', stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), marginL + colW * 2);
  stat('Max drawdown', `${dd.toFixed(1)}%`, marginL + colW * 3, dd > 15 ? BAD : dd > 8 ? WARN : GOOD);
  y += 12;
  stat('Gain moyen', money(stats.avgWin, currency, 0), marginL, GOOD);
  stat('Perte moyenne', money(stats.avgLoss, currency, 0), marginL + colW, BAD);
  stat('Espérance', money(stats.expectancyUsd, currency, 1), marginL + colW * 2, stats.expectancyUsd >= 0 ? GOOD : BAD);
  stat('Solde initial', money(initial, currency), marginL + colW * 3);
  y += 14;

  doc.setDrawColor(...GRID);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  // ── Equity curve ──
  if (trades.length >= 2) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...INK);
    doc.text("Courbe d'équité", marginL, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    y += 4;
    const chartH = 40;
    const geo = drawCurve(doc, curve, { x: marginL, y, w: contentW, h: chartH }, {
      fillTop: [0, 209, 255], fillBottom: [255, 255, 255], stroke: CYAN_DARK, baselineY: initial,
    });
    if (geo) {
      doc.setFontSize(7);
      doc.setTextColor(...MUTE);
      doc.text(money(geo.max, currency), marginL + contentW + 1, geo.yFor(geo.max) + 1);
      doc.text(money(geo.min, currency), marginL + contentW + 1, geo.yFor(geo.min) + 1);
      doc.setTextColor(0);
    }
    y += chartH + 10;
  }

  // ── Discipline ──
  if (disc) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`Discipline — ${disc.score}/100 (${disc.band.label})`, marginL, y);
    doc.setFont(undefined, 'normal');
    y += 5;
    const rows = [
      ['Stop-loss utilisé', disc.breakdown.stopLoss, 25],
      ['Journal rempli', disc.breakdown.journal, 25],
      ['État émotionnel', disc.breakdown.emotion, 25],
      ['Qualité de process', disc.breakdown.process, 25],
    ];
    const halfW = (contentW - 6) / 2;
    rows.forEach(([label, val, max], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const bx = marginL + col * (halfW + 6);
      const by = y + row * 9;
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTE);
      doc.text(label, bx, by);
      doc.setTextColor(...INK);
      doc.text(`${Math.round((val / max) * 100)}%`, bx + halfW, by, { align: 'right' });
      progressBar(doc, bx, by + 1.5, halfW, (val / max) * 100, CYAN_DARK);
      doc.setTextColor(0);
    });
    y += 22;
    if (disc.revengeCount || disc.tiltCount) {
      doc.setFontSize(8);
      doc.setTextColor(...WARN);
      doc.text(`⚠ ${disc.revengeCount} trade(s) de revanche · ${disc.tiltCount} séquence(s) de tilt détectée(s) sur la période.`, marginL, y);
      doc.setTextColor(0);
      y += 8;
    }
  }

  // ── Prop firm rules ──
  if (isPropFirm && propProgress && account.propFirmRules) {
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setDrawColor(...GRID);
    doc.line(marginL, y, pageW - marginR, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`Règles Prop Firm — Phase ${account.phase || ''}`, marginL, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    const rules = account.propFirmRules;
    const gaugeRow = (label, pct, target, unit = '%') => {
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTE);
      doc.text(label, marginL, y);
      doc.setTextColor(...INK);
      doc.text(`${pct}${unit} / ${target}${unit}`, pageW - marginR, y, { align: 'right' });
      progressBar(doc, marginL, y + 1.5, contentW, target ? (pct / target) * 100 : 0, pct > target ? BAD : CYAN_DARK);
      doc.setTextColor(0);
      y += 8;
    };
    if (rules.profitTargetPct != null) gaugeRow('Objectif de profit', propProgress.profitPct, rules.profitTargetPct);
    if (rules.maxDailyLossPct != null) gaugeRow('Perte quotidienne (aujourd\'hui)', propProgress.dailyLossPct, rules.maxDailyLossPct);
    if (rules.maxTotalDrawdownPct != null) gaugeRow('Drawdown / perte totale', propProgress.maxDrawdownPct, rules.maxTotalDrawdownPct);
    if (rules.minTradingDays != null) gaugeRow('Jours de trading', propProgress.tradingDays, rules.minTradingDays, '');
    if (propProgress.breaches.length) {
      doc.setFontSize(7.5);
      for (const b of propProgress.breaches) {
        if (y > pageH - 20) { doc.addPage(); y = 20; }
        doc.setTextColor(...(b.level === 'danger' ? BAD : WARN));
        const lines = doc.splitTextToSize(`• ${b.message}`, contentW);
        for (const line of lines) { doc.text(line, marginL, y); y += 4.2; }
      }
      doc.setTextColor(0);
    }
  }

  // ── Trade journal ──
  if (trades.length) {
    doc.addPage();
    let py = 20;
    const cols = [
      { key: 'date', label: 'Date', w: 20 },
      { key: 'instrument', label: 'Instrument', w: 26 },
      { key: 'direction', label: 'Sens', w: 14 },
      { key: 'strategy', label: 'Stratégie', w: 28 },
      { key: 'entry', label: 'Entrée', w: 20 },
      { key: 'exit', label: 'Sortie', w: 20 },
      { key: 'r', label: 'R', w: 14 },
      { key: 'pnl', label: 'P&L', w: 26 },
      { key: 'emotion', label: 'Émotion', w: 18 },
    ];
    const colX = [];
    { let x = marginL; for (const c of cols) { colX.push(x); x += c.w; } }

    const drawTableHeader = () => {
      gradientBar(doc, 0, 0, pageW, 16, NAVY, CYAN_DARK);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(`${account.name} — Journal des trades`, marginL, 10);
      doc.setTextColor(0);
      py = 24;
      doc.setFillColor(245, 246, 248);
      doc.rect(marginL, py - 4.6, contentW, 6.2, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(90);
      cols.forEach((c, i) => doc.text(c.label, colX[i] + 1.5, py - 0.8));
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0);
      doc.setDrawColor(...GRID);
      doc.line(marginL, py + 1, pageW - marginR, py + 1);
      py += 6.5;
    };

    drawTableHeader();
    const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    let zebra = 0;
    for (const t of sorted) {
      if (py > pageH - 16) { doc.addPage(); drawTableHeader(); zebra = 0; }
      if (zebra % 2 === 1) { doc.setFillColor(249, 250, 251); doc.rect(marginL, py - 4.4, contentW, 6, 'F'); }
      zebra++;
      const r = t.riskAmount > 0 ? t.pnl / t.riskAmount : null;
      doc.setFontSize(7);
      doc.setTextColor(...INK);
      doc.text(String(t.date).slice(0, 10), colX[0] + 1.5, py);
      doc.text(String(t.instrument || '—'), colX[1] + 1.5, py);
      doc.setTextColor(...(t.direction === 'long' ? GOOD : t.direction === 'short' ? BAD : MUTE));
      doc.text((t.direction || '—').toUpperCase(), colX[2] + 1.5, py);
      doc.setTextColor(...INK);
      const strat = String(t.strategy || '—');
      doc.text(doc.getTextWidth(strat) > cols[3].w - 3 ? `${strat.slice(0, 16)}…` : strat, colX[3] + 1.5, py);
      doc.setTextColor(...MUTE);
      doc.text(t.entryPrice != null ? String(t.entryPrice) : '—', colX[4] + 1.5, py);
      doc.text(t.exitPrice != null ? String(t.exitPrice) : '—', colX[5] + 1.5, py);
      doc.setTextColor(...INK);
      doc.text(r != null ? `${r.toFixed(1)}R` : '—', colX[6] + 1.5, py);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...(t.pnl >= 0 ? GOOD : BAD));
      doc.text(signedMoney(t.pnl, currency), colX[7] + 1.5, py);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...MUTE);
      doc.text(String(t.journal?.emotion || '—'), colX[8] + 1.5, py);
      doc.setTextColor(0);
      py += 6;
    }
  }

  // ── Footers ──
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GRID);
    doc.line(marginL, pageH - 11, pageW - marginR, pageH - 11);
    doc.setFontSize(7);
    doc.setTextColor(...MUTE);
    doc.text(`AUDAX · ${account.name}`, marginL, pageH - 7);
    doc.text(`Page ${p} / ${total}`, pageW - marginR, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }

  doc.save(`audax-rapport-${fileBase}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
