/**
 * CorrelationNetwork — Network graph of cross-module correlations.
 * Nodes = metrics, edges = significant correlations (thicker = stronger).
 * Pure SVG implementation.
 */
import { useMemo, useState } from 'react';
import { Card, Badge } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';
import {
  computeAllCorrelations,
  CORRELATION_CATEGORIES,
  CORRELATION_PAIRS,
  extractPairData,
  pearson,
} from '../../../../utils/correlation-engine';

const NODE_COLORS = {
  performance: 'var(--accent)',
  recovery: '#a78bfa',
  nutrition: 'var(--warning)',
  discipline: 'var(--success)',
  habits: '#34d399',
  body: '#f472b6',
};

export default function CorrelationNetwork() {
  const store = useProgramStore();
  const { kpis, kpiValuesByKpi } = store;
  const [selectedCorr, setSelectedCorr] = useState(null);
  const [minR, setMinR] = useState(0.3);

  const correlations = useMemo(
    () => computeAllCorrelations(kpiValuesByKpi, kpis, 30),
    [kpiValuesByKpi, kpis]
  );

  const filtered = correlations.filter((c) => Math.abs(c.r) >= minR);

  // Build node positions in a circle layout
  const { nodes, edges, svgW, svgH } = useMemo(() => {
    // Collect unique metric keys from filtered correlations
    const metricSet = new Set();
    for (const c of filtered) {
      metricSet.add(c.pair.metricA.key);
      metricSet.add(c.pair.metricB.key);
    }
    const metricKeys = [...metricSet];
    if (!metricKeys.length) return { nodes: [], edges: [], svgW: 400, svgH: 300 };

    const W = 500, H = 400;
    const cx = W / 2, cy = H / 2, radius = Math.min(cx, cy) - 50;

    const nodeMap = {};
    metricKeys.forEach((key, i) => {
      const angle = (2 * Math.PI * i) / metricKeys.length - Math.PI / 2;
      // Find category from CORRELATION_PAIRS
      let cat = 'performance';
      for (const p of CORRELATION_PAIRS) {
        if (p.metricA.key === key || p.metricB.key === key) { cat = p.category; break; }
      }
      // Find label
      let label = key;
      for (const p of CORRELATION_PAIRS) {
        if (p.metricA.key === key) { label = p.metricA.label; break; }
        if (p.metricB.key === key) { label = p.metricB.label; break; }
      }

      nodeMap[key] = {
        key,
        label,
        category: cat,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    const edgeList = filtered.map((c) => ({
      id: c.pair.id,
      from: nodeMap[c.pair.metricA.key],
      to: nodeMap[c.pair.metricB.key],
      r: c.r,
      strength: c.strength,
      pair: c.pair,
    })).filter((e) => e.from && e.to);

    return { nodes: Object.values(nodeMap), edges: edgeList, svgW: W, svgH: H };
  }, [filtered]);

  if (!correlations.length) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Pas assez de données pour calculer les corrélations.<br />
          <span className="text-[10px]">Ajoutez des KPIs et enregistrez des données sur plusieurs jours.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card title="🔗 Réseau de Corrélations">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs text-mute">Seuil |r| ≥</span>
        {[0.2, 0.3, 0.5, 0.7].map((threshold) => (
          <button
            key={threshold}
            onClick={() => setMinR(threshold)}
            className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
              minR === threshold ? 'bg-accent/20 text-accent border border-accent/30' : 'text-mute border border-line hover:border-accent/20'
            }`}
          >
            {threshold}
          </button>
        ))}
        <span className="text-[10px] text-mute ml-auto">{filtered.length} corrélation{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* SVG Network */}
      {nodes.length > 0 ? (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 400 }}>
            {/* Edges */}
            {edges.map((e) => {
              const isSelected = selectedCorr === e.id;
              const color = e.r > 0 ? 'var(--success)' : 'var(--danger, #ef4444)';
              const width = Math.max(1, Math.abs(e.r) * 5);
              return (
                <line
                  key={e.id}
                  x1={e.from.x} y1={e.from.y}
                  x2={e.to.x} y2={e.to.y}
                  stroke={color}
                  strokeWidth={isSelected ? width + 2 : width}
                  strokeOpacity={isSelected ? 1 : 0.4}
                  onClick={() => setSelectedCorr(isSelected ? null : e.id)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g key={node.key}>
                <circle
                  cx={node.x} cy={node.y} r={8}
                  fill={NODE_COLORS[node.category] || 'var(--text-mute)'}
                  stroke="var(--bg-card)" strokeWidth={2}
                />
                <text
                  x={node.x} y={node.y + 18}
                  textAnchor="middle"
                  style={{ fill: 'var(--text-mute)', fontSize: 8, fontFamily: 'system-ui' }}
                >
                  {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="text-sm text-mute text-center py-6">
          Aucune corrélation au-dessus du seuil.
        </div>
      )}

      {/* Selected correlation detail */}
      {selectedCorr && (() => {
        const c = filtered.find((f) => f.pair.id === selectedCorr);
        if (!c) return null;
        return (
          <div className="mt-3 p-3 bg-surface border border-line rounded-lg">
            <div className="text-sm font-medium">{c.pair.label}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge color={c.r > 0 ? 'var(--success)' : 'var(--danger, #ef4444)'}>
                r = {c.r.toFixed(3)}
              </Badge>
              <Badge>{c.strength}</Badge>
              <Badge>{c.direction}</Badge>
              <span className="text-[10px] text-mute">n = {c.n} jours</span>
              {c.significant && <Badge color="var(--accent)">Significatif</Badge>}
            </div>
            <p className="text-xs text-mute mt-2 italic">{c.pair.insight}</p>
          </div>
        );
      })()}

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-line">
        {CORRELATION_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center gap-1 text-[10px] text-mute">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: NODE_COLORS[cat.key] }} />
            {cat.icon} {cat.label}
          </div>
        ))}
      </div>
    </Card>
  );
}
