import { useState } from 'react';
import { Rocket, FileText } from 'lucide-react';
import { Card, Button, Input, Field } from '../../../../components/common/ui';
import { useProgramStore } from '../../../../store/programStore';

/**
 * Step 1 of program creation: just a name.
 * Creates a draft in Supabase and hands off to the full program editor (ProgramTab).
 */
export default function CreateProgramWizard({ onCreated }) {
  const { createProgram, loading } = useProgramStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Le nom est requis'); return; }
    setError('');
    try {
      const program = await createProgram(name.trim());
      onCreated?.(program);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création');
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <Card>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-3">
            <FileText size={28} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold">Commencer un programme</h2>
          <p className="text-sm text-mute mt-1">
            Un programme structure vos objectifs, séances et nutrition<br />
            sur plusieurs phases. Vous pourrez l'activer une fois prêt.
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Nom du programme">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Préparation été 2027, Masse hivernale, Remise en forme…"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </Field>

          {error && <div className="text-xs text-bad">{error}</div>}

          <Button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full">
            <span className="flex items-center gap-2 justify-center">
              <Rocket size={16} /> {loading ? 'Création…' : 'Commencer'}
            </span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
