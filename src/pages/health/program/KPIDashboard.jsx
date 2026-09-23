import { useState } from 'react';
import { BarChart3, Plus, Trash2, Pin, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Button, Field, Input, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { toast } from '../../../store/uiStore';
import { KPI_LIBRARY, KPI_CATEGORIES, getKpiDefinition } from '../../../utils/kpi-library';

// Gym metrics that only make sense per-exercise. Bound to a chosen exercise and
// stored as CUSTOM KPIs (kpi_key null) so several exercises can each have one
// without hitting the (program_id, kpi_key) unique constraint.
const EXERCISE_BINDABLE = new Set(['estimated_1rm', 'max_weight_lifted', 'total_volume']);

// custom_source "metric::Exercise Name" → { metricKey, exerciseName } | null
function parseExerciseBinding(kpi) {
  const src = kpi?.custom_source || '';
  const i = src.indexOf('::');
  if (i === -1) return null;
  const metricKey = src.slice(0, i);
  const exerciseName = src.slice(i + 2);
  if (!EXERCISE_BINDABLE.has(metricKey) || !exerciseName) return null;
  return { metricKey, exerciseName };
}

/**
 * KPI Dashboard — shows tracked KPIs with latest values, trends, and targets.
 */
export default function KPIDashboard() {
  const store = useProgramStore();
  const program = store.activeProgram || store.draftProgram;
  const { kpis } = store;
  const [adding, setAdding] = useState(false);

  if (!program) return null;

  // Group KPIs by category
  const grouped = {};
  for (const kpi of kpis) {
    const binding = parseExerciseBinding(kpi);
    const def = binding ? getKpiDefinition(binding.metricKey) : (kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null);
    const cat = def?.category || 'custom';
    (grouped[cat] ||= []).push({ kpi, def });
  }

  return (
    <Card title="KPIs" action={
      <Button variant="secondary" onClick={() => setAdding(true)}>
        <span className="flex items-center gap-1"><Plus size={14} /> Ajouter un KPI</span>
      </Button>
    }>
      {kpis.length === 0 ? (
        <EmptyState>
          <BarChart3 size={20} className="mx-auto mb-2" />
          Aucun KPI suivi. Ajoutez des indicateurs pour mesurer votre progression.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Pinned KPIs first */}
          {kpis.filter((k) => k.is_pinned).length > 0 && (
            <div>
              <div className="text-[10px] text-mute uppercase tracking-wider mb-2 flex items-center gap-1">
                <Pin size={10} /> Épinglés
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kpis.filter((k) => k.is_pinned).map((kpi) => (
                  <KpiTile key={kpi.id} kpi={kpi} />
                ))}
              </div>
            </div>
          )}

          {/* By category */}
          {Object.entries(grouped).map(([cat, items]) => {
            const catMeta = KPI_CATEGORIES.find((c) => c.key === cat);
            return (
              <div key={cat}>
                <div className="text-[10px] text-mute uppercase tracking-wider mb-2 flex items-center gap-1">
                  {catMeta?.icon || '📊'} {catMeta?.label || 'Personnalisé'}
                </div>
                <div className="space-y-1">
                  {items.map(({ kpi, def }) => (
                    <KpiRow key={kpi.id} kpi={kpi} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <AddKpiModal
          programId={program.id}
          existingKeys={kpis.filter((k) => k.kpi_key).map((k) => k.kpi_key)}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}

// Name + unit of a KPI whatever its kind (library, exercise-bound, custom).
function kpiLabel(kpi) {
  const binding = parseExerciseBinding(kpi);
  const def = binding ? getKpiDefinition(binding.metricKey) : (kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null);
  return {
    name: kpi.custom_name || def?.name || kpi.kpi_key,
    unit: def?.unit || kpi.custom_unit || '',
    manual: !binding && !kpi.kpi_key, // custom KPI → values entered by hand
  };
}

function Sparkline({ series, color = 'var(--accent-primary)' }) {
  const pts = series.slice(-14);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min || 1;
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${28 - ((p.value - min) / span) * 24 - 2}`).join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-2 h-7 w-full">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiTile({ kpi }) {
  const store = useProgramStore();
  const { series, latest, trend } = store.getKpiSeries(kpi);
  const { name, unit } = kpiLabel(kpi);
  const good = trend == null ? null : (kpi.target_direction === 'lower' ? trend <= 0 : trend >= 0);

  return (
    <div className="rounded-xl border border-line bg-surface/70 p-3">
      <div className="mb-1 truncate text-[11px] text-mute">{name}</div>
      <div className="flex items-end gap-1">
        <span className="text-xl font-bold text-ink">{latest ? formatValue(latest.value) : '—'}</span>
        <span className="mb-0.5 text-xs text-mute">{unit}</span>
      </div>
      {trend != null && trend !== 0 && (
        <div className={`mt-0.5 flex items-center gap-0.5 text-[11px] ${good ? 'text-good' : 'text-bad'}`}>
          {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {trend > 0 ? '+' : ''}{formatValue(trend)} {unit}
        </div>
      )}
      <Sparkline series={series} />
      {kpi.target_value != null && latest && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, (latest.value / kpi.target_value) * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

function KpiRow({ kpi }) {
  const store = useProgramStore();
  const { series, latest, trend } = store.getKpiSeries(kpi);
  const { name, unit, manual } = kpiLabel(kpi);
  const [entering, setEntering] = useState(false);
  const [val, setVal] = useState('');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const saveValue = async () => {
    if (val === '' || !Number.isFinite(Number(val))) return;
    try {
      await store.saveKpiValue(kpi.id, { value_date: todayStr, value: Number(val), source: 'manual' });
      setVal(''); setEntering(false);
    } catch (err) { toast(err?.message || 'Enregistrement impossible', 'error'); }
  };

  const reached = kpi.target_value != null && latest
    && (kpi.target_direction === 'lower' ? latest.value <= kpi.target_value : latest.value >= kpi.target_value);

  return (
    <div className="group flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
      <button onClick={() => store.updateKpi(kpi.id, { is_pinned: !kpi.is_pinned })} className="text-mute hover:text-accent cursor-pointer" title="Épingler">
        <Pin size={13} className={kpi.is_pinned ? 'fill-accent text-accent' : ''} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{name}</div>
        <div className="text-[11px] text-mute">
          {series.length ? `${series.length} mesure(s)` : manual ? 'Saisie manuelle' : 'En attente de données'}
          {trend != null && trend !== 0 && ` · ${trend > 0 ? '+' : ''}${formatValue(trend)} ${unit}`}
        </div>
      </div>
      <span className="text-sm font-semibold text-ink">{latest ? `${formatValue(latest.value)} ${unit}` : '—'}</span>
      {kpi.target_value != null && (
        <Badge color={reached ? 'var(--success)' : 'var(--text-secondary)'}>Cible : {formatValue(kpi.target_value)} {unit}</Badge>
      )}
      {manual && (entering ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus type="number" value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveValue(); if (e.key === 'Escape') setEntering(false); }}
            placeholder={unit || 'valeur'}
            className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
          <Button onClick={saveValue} className="!px-2 !py-1 text-xs">OK</Button>
        </span>
      ) : (
        <Button variant="secondary" onClick={() => setEntering(true)} className="!px-2 !py-1 text-xs">
          <span className="flex items-center gap-1"><Plus size={12} /> Valeur du jour</span>
        </Button>
      ))}
      <button onClick={() => store.removeKpi(kpi.id)} className="text-mute opacity-0 transition-opacity hover:text-bad group-hover:opacity-100 cursor-pointer" title="Supprimer">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AddKpiModal({ programId, existingKeys, onClose }) {
  const store = useProgramStore();
  const [mode, setMode] = useState('library'); // 'library' | 'custom'
  const [selectedKey, setSelectedKey] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetDirection, setTargetDirection] = useState('higher');
  const [exerciseName, setExerciseName] = useState('');
  const [saving, setSaving] = useState(false);

  const programExercises = store.getProgramExercises();
  // Exercise-specific gym metrics can be added once per exercise, so they are
  // NOT filtered out by existingKeys (they're stored as custom KPIs anyway).
  const available = KPI_LIBRARY.filter((k) => EXERCISE_BINDABLE.has(k.key) || !existingKeys.includes(k.key));
  const isBindable = mode === 'library' && EXERCISE_BINDABLE.has(selectedKey);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isBindable && selectedKey && exerciseName.trim()) {
        // Per-exercise gym KPI → stored as a custom KPI bound via custom_source
        const def = getKpiDefinition(selectedKey);
        const exName = exerciseName.trim();
        await store.addKpi(programId, {
          custom_name: `${def.name} — ${exName}`,
          custom_unit: def.unit,
          custom_source: `${selectedKey}::${exName}`,
          target_value: targetValue ? parseFloat(targetValue) : null,
          target_direction: targetDirection,
        });
      } else if (mode === 'library' && selectedKey) {
        await store.addKpi(programId, {
          kpi_key: selectedKey,
          target_value: targetValue ? parseFloat(targetValue) : null,
          target_direction: targetDirection,
        });
      } else if (mode === 'custom' && customName.trim()) {
        await store.addKpi(programId, {
          custom_name: customName.trim(),
          custom_unit: customUnit || null,
          custom_source: 'manual',
          target_value: targetValue ? parseFloat(targetValue) : null,
          target_direction: targetDirection,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Ajouter un KPI">
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button variant={mode === 'library' ? 'primary' : 'secondary'} onClick={() => setMode('library')}>
            Bibliothèque
          </Button>
          <Button variant={mode === 'custom' ? 'primary' : 'secondary'} onClick={() => setMode('custom')}>
            Personnalisé
          </Button>
        </div>

        {mode === 'library' ? (
          <div className="max-h-60 overflow-y-auto space-y-1">
            {KPI_CATEGORIES.map((cat) => {
              const items = available.filter((k) => k.category === cat.key);
              if (!items.length) return null;
              return (
                <div key={cat.key}>
                  <div className="text-[10px] text-mute uppercase tracking-wider mt-2 mb-1">
                    {cat.icon} {cat.label}
                  </div>
                  {items.map((kpi) => (
                    <button
                      key={kpi.key}
                      onClick={() => setSelectedKey(kpi.key)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                        selectedKey === kpi.key
                          ? 'bg-accent/10 text-accent border border-accent/30'
                          : 'hover:bg-surface border border-transparent'
                      }`}
                    >
                      {kpi.name} <span className="text-xs text-mute">({kpi.unit})</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Nom du KPI">
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="ex: Temps de récupération moyen" />
            </Field>
            <Field label="Unité">
              <Input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="ex: min, kg, %" />
            </Field>
          </div>
        )}

        {isBindable && (
          <Field label="Sur quel exercice ?" hint="Le KPI suivra cet exercice spécifiquement (1RM, charge max, volume).">
            {programExercises.length > 0 ? (
              <Select value={exerciseName} onChange={(e) => setExerciseName(e.target.value)}>
                <option value="">— Choisir un exercice —</option>
                {programExercises.map((ex) => (
                  <option key={ex.name} value={ex.name}>{ex.name}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                placeholder="ex: Barbell Bench Press"
              />
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cible (optionnel)">
            <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Direction">
            <Select value={targetDirection} onChange={(e) => setTargetDirection(e.target.value)}>
              <option value="higher">Plus haut = mieux</option>
              <option value="lower">Plus bas = mieux</option>
              <option value="range">Plage idéale</option>
              <option value="exact">Valeur exacte</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || (mode === 'library' && !selectedKey) || (isBindable && !exerciseName.trim()) || (mode === 'custom' && !customName.trim())}>
          {saving ? 'Ajout…' : 'Ajouter'}
        </Button>
      </div>
    </Modal>
  );
}

function formatValue(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}
