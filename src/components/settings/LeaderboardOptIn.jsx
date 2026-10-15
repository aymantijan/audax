import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card, Button, Field, Input } from '../common/ui';
import { toast } from '../../store/uiStore';

// « Apparaître dans le classement » (chantier 8, C3): off by default, under a
// pseudonym. What others see: the pseudonym, the XP and (if chosen) the job.
export default function LeaderboardOptIn() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const on = !!user?.leaderboardOptIn;
  const [name, setName] = useState(user?.leaderboardName || '');
  const [showJob, setShowJob] = useState(!!user?.leaderboardShowOccupation);

  const save = (optIn) => {
    updateProfile({ leaderboardOptIn: optIn, leaderboardName: name.trim(), leaderboardShowOccupation: showJob });
    toast(optIn ? 'Tu apparais dans le classement.' : 'Tu n’apparais plus dans le classement.', 'success');
  };

  return (
    <Card title={<span className="flex items-center gap-2">{on ? <Eye size={15} /> : <EyeOff size={15} />} Apparaître dans le classement</span>}>
      <p className="text-sm text-mute mb-3">
        {on ? 'Les autres utilisateurs voient ton pseudo et ton XP. Rien d’autre de tes données n’est partagé.' : 'Pour l’instant, personne ne te voit : tu es seul·e à voir ton rang. Si tu choisis d’apparaître, les autres verront seulement ton pseudo et ton XP.'}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Pseudo" hint="Vide = ton prénom."><Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={user?.name || 'Ton pseudo'} /></Field>
        {user?.occupation && (
          <label className="flex items-center gap-2 text-sm cursor-pointer sm:mt-7">
            <input type="checkbox" checked={showJob} onChange={(e) => setShowJob(e.target.checked)} /> Montrer aussi mon métier ({user.occupation})
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {on ? (
          <>
            <Button onClick={() => save(true)}>Enregistrer</Button>
            <Button variant="secondary" onClick={() => save(false)}>Ne plus apparaître</Button>
          </>
        ) : <Button onClick={() => save(true)}>Apparaître dans le classement</Button>}
      </div>
    </Card>
  );
}
