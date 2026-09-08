/**
 * SpiralTimeline — 3D spiral visualization of programme progress.
 * Uses CSS 3D transforms (no Three.js dependency).
 * Each day is a node on the spiral; color encodes discipline score.
 */
import { useMemo, useState, useRef } from 'react';
import { Card } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

function scoreColor(score) {
  if (score == null) return '#3338';
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#22c55e99';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f59e0baa';
  return '#ef4444';
}

export default function SpiralTimeline() {
  const store = useProgramStore();
  const program = store.activeProgram;
  const { phases } = store;
  const containerRef = useRef(null);

  const [rotateX, setRotateX] = useState(-20);
  const [rotateY, setRotateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startRX: 0, startRY: 0 });

  const days = useMemo(() => {
    if (!program?.start_date) return [];

    const startDate = new Date(program.start_date);
    const endDate = program.end_date ? new Date(program.end_date) : new Date();
    const totalDays = Math.min(180, Math.ceil((endDate - startDate) / 86400000) + 1);

    const result = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const discipline = store.disciplineByDate[dateStr];
      const phase = phases.find((p) => p.start_date <= dateStr && p.end_date >= dateStr);

      result.push({
        index: i,
        date: dateStr,
        score: discipline?.overall_score ?? null,
        phase: phase?.name || null,
        isToday: dateStr === new Date().toISOString().slice(0, 10),
      });
    }
    return result;
  }, [program, phases, store.disciplineByDate]);

  // Spiral parameters
  const spiralNodes = useMemo(() => {
    const n = days.length;
    if (!n) return [];

    const turnsPerRevolution = 14; // days per revolution
    const radiusBase = 120;
    const heightPerDay = 2.5;

    return days.map((day, i) => {
      const angle = (i / turnsPerRevolution) * 2 * Math.PI;
      const radius = radiusBase + i * 0.3; // slowly growing spiral
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -i * heightPerDay; // going downward

      return {
        ...day,
        x, y, z,
        size: day.isToday ? 10 : day.score != null ? 7 : 4,
      };
    });
  }, [days]);

  // Mouse drag for rotation
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRX: rotateX,
      startRY: rotateY,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setRotateY(dragRef.current.startRY + dx * 0.5);
    setRotateX(Math.max(-60, Math.min(10, dragRef.current.startRX + dy * 0.3)));
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!days.length) {
    return (
      <Card>
        <div className="text-sm text-mute text-center py-6">
          Activez un programme avec des dates pour voir la spirale 3D.
        </div>
      </Card>
    );
  }

  // We need the total height for centering
  const totalHeight = days.length * 2.5;

  return (
    <Card title="🌀 Spirale Temporelle 3D">
      <div className="text-xs text-mute mb-2">Glissez pour tourner · Chaque point = 1 jour · Couleur = discipline</div>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-surface border border-line select-none"
        style={{
          height: 400,
          perspective: '800px',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {/* Spiral nodes */}
          {spiralNodes.map((node) => (
            <div
              key={node.date}
              className="absolute rounded-full"
              style={{
                width: node.size,
                height: node.size,
                background: scoreColor(node.score),
                transform: `translate3d(${node.x}px, ${node.y + totalHeight / 2}px, ${node.z}px)`,
                boxShadow: node.isToday
                  ? `0 0 12px 3px var(--accent)`
                  : node.score != null
                    ? `0 0 4px 1px ${scoreColor(node.score)}40`
                    : 'none',
                border: node.isToday ? '2px solid var(--accent)' : 'none',
              }}
              title={`${node.date}${node.score != null ? ` — ${Math.round(node.score)}/100` : ''}${node.phase ? ` — ${node.phase}` : ''}`}
            />
          ))}

          {/* Connection lines between consecutive scored days */}
          {spiralNodes.map((node, i) => {
            if (i === 0) return null;
            const prev = spiralNodes[i - 1];
            if (node.score == null && prev.score == null) return null;

            // SVG line connecting prev → node (simplified as a thin div)
            const dx = node.x - prev.x;
            const dy = (node.y - prev.y);
            const dz = node.z - prev.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return (
              <div
                key={`line-${node.date}`}
                className="absolute"
                style={{
                  width: length,
                  height: 1,
                  background: `${scoreColor(node.score)}40`,
                  transformOrigin: '0 0',
                  transform: `translate3d(${prev.x}px, ${prev.y + totalHeight / 2}px, ${prev.z}px) ` +
                    `rotateY(${Math.atan2(dz, dx) * (180 / Math.PI)}deg) ` +
                    `rotateZ(${Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI)}deg)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[9px] text-mute">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-accent shadow-[0_0_6px_var(--accent)]" />
          Aujourd'hui
        </div>
        {[90, 75, 60, 40, 20].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: scoreColor(s) }} />
            {s >= 90 ? '≥90' : s >= 75 ? '75+' : s >= 60 ? '60+' : s >= 40 ? '40+' : '<40'}
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: '#3338' }} />
          Pas de données
        </div>
      </div>
    </Card>
  );
}
