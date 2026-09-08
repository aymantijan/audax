import { useState } from 'react';
import { BarChart3, Plus, Trash2, Pin, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Button, Field, Input, Select, Badge, EmptyState, Modal } from '../../../components/common/ui';
import { useProgramStore } from '../../../store/programStore';
import { KPI_LIBRARY, KPI_CATEGORIES, getKpiDefinition } from '../../../utils/kpi-library';

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
    const def = kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
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
                    <KpiRow key={kpi.id} kpi={kpi} def={def} />
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

function KpiTile({ kpi }) {
  const store = useProgramStore();
  const def = kpi.kpi_key ? getKpiDefinition(kpi.kpi_key) : null;
  const latest = store.getLatestKpiValue(kpi.id);
  const values = store.getKpiValues(kpi.id);

  // Compute trend (last vs previous)
  const trend = values.length >= 2
    ? values[values.length - 1].value - values[values.length - 2].value
    : null;

  const name = def?.name || kpi.custom_name || kpi.kpi_key;
  const unit = def?.unit || kpi.custom_unit || '';

  return (
    <div className="bg-surface border border-line rounded-lg p-3">
      <div className="text-[10px] text-mute mb-1 truncate">{name}</div>
      <div className="flex items-end gap-1">
        <span className="text-xl font-bold text-ink">
          {latest ? formatValue(latest.value) : '—'}
        </span>
        <span className="text-xs text-mute mb-0.5">{unit}</span>
      </div>
      {trend != null && (
        <div className={`text-[10px] flex items-center gap-0.5 mt-1 ${trend >= 0 ? 'text-good' : 'text-bad'}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend >= 0 ? '+' : ''}{formatValue(trend)} {unit}
        </div>
      )}
      {kpi.target_value != null && latest && (
        <div className="mt-1.5 h-1.5 bg-card rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, (latest.value / kpi.target_value) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function KpiRow({ kpi, def }) {
  const store = useProgramStore();
  const latest = store.getLatestKpiValue(kpi.id);
  const name = def?.name || kpi.custom_name || kpi.kpi_key;
  const unit = def?.unit || kpi.custom_unit || '';

  const handleRemove = async () => {
    const program = store.activeProgram || store.draftProgram;
    if (program) await store.removeKpi(kpi.id);
  };

  const handleTogglePin = async () => {
    await store.updateKpi(kpi.id, { is_pinned: !kpi.is_pinned });
  };

  return (
    <div className="flex items-center gap-3 border border-line rounded-lg px-3 py-2 group">
      <button onClick={handleTogglePin} className="text-mute hover:text-accent cursor-pointer">
        <Pin size={12} className={kpi.is_pinned ? 'text-accent fill-accent' : ''} />
      </button>
      <span className="text-sm flex-1">{name}</span>
      <span className="text-sm font-medium">
        {latest ? `${formatValue(latest.value)} ${unit}` : '—'}
      </span>
      {kpi.target_value != null && (
        <Badge color={latest && latest.value >= kpi.target_value ? 'var(--success)' : 'var(--text-mute)'}>
          Cible: {formatValue(kpi.target_value)} {unit}
        </Badge>
      )}
      <button onClick={handleRemove} className="text-mute hover:text-bad opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
        <Trash2 size={12} />
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
  const [saving, setSaving] = useState(false);

  const available = KPI_LIBRARY.filter((k) => !existingKeys.includes(k.key));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'library' && selectedKey) {
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
        <Button onClick={handleSave} disabled={saving || (mode === 'library' && !selectedKey) || (mode === 'custom' && !customName.trim())}>
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
