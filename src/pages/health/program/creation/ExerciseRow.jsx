import { Trash2, GripVertical } from 'lucide-react';
import { Input } from '../../../../components/common/ui';

/**
 * A single exercise row in the session builder.
 * All numeric fields are pre-filled with sensible defaults and editable on click.
 */
export default function ExerciseRow({ exercise, index, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...exercise, [field]: value });

  const repsLabel = exercise.reps_min === exercise.reps_max
    ? `${exercise.reps_min}`
    : `${exercise.reps_min}-${exercise.reps_max}`;

  return (
    <div className="flex items-start gap-2 group border border-line rounded-lg p-3 bg-surface hover:border-accent/40 transition-colors">
      <div className="text-mute pt-1 cursor-grab opacity-0 group-hover:opacity-60"><GripVertical size={14} /></div>

      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
        {/* Exercise name — col 1-4 */}
        <div className="col-span-4">
          <Input
            value={exercise.exercise_name}
            onChange={(e) => update('exercise_name', e.target.value)}
            placeholder="Exercice"
            className="!py-1.5 !text-sm font-medium"
          />
        </div>

        {/* Sets — col 5 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Séries</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={exercise.sets_count}
            onChange={(e) => update('sets_count', parseInt(e.target.value) || 1)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Reps min — col 6 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Reps min</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={exercise.reps_min}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 1;
              update('reps_min', v);
              // auto-update prefill to midpoint
              const mid = Math.round((v + (exercise.reps_max || v)) / 2);
              onChange(index, { ...exercise, reps_min: v, reps_prefill: mid });
            }}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Reps max — col 7 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Reps max</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={exercise.reps_max}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 1;
              const mid = Math.round(((exercise.reps_min || v) + v) / 2);
              onChange(index, { ...exercise, reps_max: v, reps_prefill: mid });
            }}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Rest — col 8 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Repos (s)</label>
          <Input
            type="number"
            min={0}
            step={15}
            value={exercise.rest_seconds}
            onChange={(e) => update('rest_seconds', parseInt(e.target.value) || 0)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* RPE — col 9 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">RPE</label>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={exercise.target_rpe}
            onChange={(e) => update('target_rpe', parseFloat(e.target.value) || 7)}
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Tempo — col 10 */}
        <div className="col-span-1">
          <label className="block text-[10px] text-mute mb-0.5">Tempo</label>
          <Input
            value={exercise.tempo || ''}
            onChange={(e) => update('tempo', e.target.value)}
            placeholder="3-1-1-0"
            className="!py-1 !px-2 !text-sm text-center"
          />
        </div>

        {/* Notes — col 11-12 */}
        <div className="col-span-2">
          <label className="block text-[10px] text-mute mb-0.5">Notes</label>
          <Input
            value={exercise.notes || ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="ex: superset"
            className="!py-1 !px-2 !text-sm"
          />
        </div>
      </div>

      <button onClick={() => onRemove(index)} className="text-mute hover:text-bad p-1 pt-5 cursor-pointer shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Default values for a new exercise row. */
ExerciseRow.blank = (order = 0) => ({
  exercise_order: order,
  exercise_name: '',
  exercise_key: null,
  sets_count: 3,
  reps_min: 8,
  reps_max: 12,
  reps_prefill: 10,
  rest_seconds: 90,
  target_rpe: 7.0,
  tempo: '',
  notes: '',
});
