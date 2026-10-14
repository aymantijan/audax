import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw, Smartphone, Cloud } from 'lucide-react';
import { useTrashStore, TRASH_DAYS } from '../../store/trashStore';
import { restoreFromTrash, countRecords } from '../../services/undo';
import { eraseThisDevice, eraseEverywhere } from '../../services/data-reset';
import { toast } from '../../store/uiStore';
import { fmtDate } from '../../utils/formatters';
import { Card, Button, Modal, EmptyState } from '../common/ui';

const SECTION = {
  learning: 'Études', habits: 'Habitudes', skills: 'Compétences', readings: 'Lectures', accounting: 'Finances',
  finance: 'Finances', health: 'Santé', focus: 'Minuteur', flashcards: 'Fiches', creative: 'Création', auth: 'Profil',
};

// Paramètres → Corbeille: everything deleted in the last 30 days, restorable.
export function TrashCard() {
  const entries = useTrashStore((s) => s.entries);
  const remove = useTrashStore((s) => s.remove);
  const clear = useTrashStore((s) => s.clear);
  const [confirmClear, setConfirmClear] = useState(false);
  const [forgetting, setForgetting] = useState(null);

  return (
    <Card
      title={`Corbeille (${entries.length})`}
      action={entries.length > 0 && <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setConfirmClear(true)}>Vider</Button>}
    >
      <p className="text-sm text-mute mb-3">Ce que tu as supprimé ces {TRASH_DAYS} derniers jours sur cet appareil. « Restaurer » le remet exactement à sa place.</p>
      {entries.length === 0 ? (
        <EmptyState icon={Trash2}>La corbeille est vide.</EmptyState>
      ) : (
        <ul className="divide-y divide-line/60">
          {entries.map((e) => {
            const n = countRecords(e);
            const where = [...new Set(e.stores.map((s) => SECTION[s.name] || s.name))].join(', ');
            return (
              <li key={e.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="text-sm font-medium truncate">{e.label}</div>
                  <div className="text-xs text-mute">{where} · {fmtDate(new Date(e.at))}{n > 1 ? ` · ${n} éléments` : ''}</div>
                </div>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => restoreFromTrash(e.id)}>
                  <span className="flex items-center gap-1.5"><RotateCcw size={13} /> Restaurer</span>
                </Button>
                <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setForgetting(e)}>Supprimer pour de bon</Button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!forgetting} onClose={() => setForgetting(null)} title="Supprimer pour de bon ?">
        <p className="text-sm text-mute">« {forgetting?.label} » ne pourra plus être restauré.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setForgetting(null)}>Garder</Button>
          <Button variant="danger" onClick={() => { remove(forgetting.id); setForgetting(null); }}>Supprimer pour de bon</Button>
        </div>
      </Modal>
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Vider la corbeille ?">
        <p className="text-sm text-mute">Les {entries.length} élément(s) de la corbeille ne pourront plus être restaurés.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>Garder</Button>
          <Button variant="danger" onClick={() => { clear(); setConfirmClear(false); }}>Vider la corbeille</Button>
        </div>
      </Modal>
    </Card>
  );
}

// Paramètres → Effacer mes données: two clearly different choices when the
// account is synced, one when the data only lives on this device.
export function EraseCard({ synced, onExport }) {
  const navigate = useNavigate();
  const [choice, setChoice] = useState(null); // 'device' | 'everywhere'
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (choice === 'everywhere' || !synced) {
        eraseEverywhere();
        toast(synced ? 'Tes données ont été effacées sur tous tes appareils.' : 'Les données de cet appareil ont été effacées.', 'warning');
      } else {
        await eraseThisDevice();
        navigate('/welcome');
        toast('Cet appareil est vidé. Reconnecte-toi pour retrouver tes données.', 'success');
      }
    } finally {
      setBusy(false);
      setChoice(null);
    }
  };

  return (
    <Card title="Effacer mes données">
      <p className="text-sm text-mute mb-4">Pense à télécharger une sauvegarde avant.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {synced ? (
          <>
            <Button variant="secondary" onClick={() => setChoice('device')}>
              <span className="flex items-center gap-2"><Smartphone size={15} /> Effacer de cet appareil seulement</span>
            </Button>
            <Button variant="danger" onClick={() => setChoice('everywhere')}>
              <span className="flex items-center gap-2"><Cloud size={15} /> Effacer partout</span>
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setChoice('everywhere')}>
            <span className="flex items-center gap-2"><Trash2 size={15} /> Effacer les données de cet appareil</span>
          </Button>
        )}
      </div>

      <Modal open={!!choice} onClose={() => setChoice(null)} title={choice === 'device' && synced ? 'Effacer cet appareil ?' : synced ? 'Effacer partout ?' : 'Effacer cet appareil ?'}>
        <div className="space-y-3 text-sm">
          {choice === 'device' && synced && (
            <p>Cet appareil sera vidé et tu seras déconnecté. <b>Ton compte garde toutes tes données</b> : elles reviendront dès que tu te reconnecteras.</p>
          )}
          {choice === 'everywhere' && synced && (
            <p>Tes cours, habitudes, données de santé, finances, lectures et compétences seront effacés <b>sur ton compte et sur tous tes appareils</b>. Ton profil reste. Ce n’est pas réversible, sauf avec une sauvegarde.</p>
          )}
          {!synced && (
            <p>Tes données ne sont que sur cet appareil : elles seront effacées <b>pour de bon</b>, sauf si tu as une sauvegarde.</p>
          )}
          {choice !== 'device' && (
            <Button variant="secondary" onClick={onExport}>Télécharger une sauvegarde d’abord</Button>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setChoice(null)}>Annuler</Button>
          <Button variant={choice === 'device' && synced ? 'primary' : 'danger'} onClick={run} disabled={busy}>
            {busy ? 'En cours…' : choice === 'device' && synced ? 'Vider cet appareil' : 'Tout effacer'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
