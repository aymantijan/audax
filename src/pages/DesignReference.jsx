import { useState } from 'react';
import { Plus, Pencil, Trash2, Inbox, CheckCircle2, Circle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, Stat, Button, Field, Input, Select, Badge, Modal, EmptyState, ProgressBar, IconButton, DataTable, playSeal } from '../components/common/ui';
import { tooltipStyle, axisTick, gridProps, SERIES } from '../components/common/chart-theme';

// Internal reference page (/design): every shared component and colour token in
// one place, so new screens reuse them instead of re-inventing styles.
const TOKENS = [
  ['--bg-primary', 'Fond'],
  ['--bg-secondary', 'Surface'],
  ['--bg-tertiary', 'Carte'],
  ['--text-primary', 'Texte'],
  ['--text-secondary', 'Texte secondaire'],
  ['--accent-primary', 'Accent (or)'],
  ['--accent-secondary', 'Accent secondaire'],
  ['--success', 'Succès'],
  ['--warning', 'Attention'],
  ['--error', 'Erreur'],
  ['--border', 'Bordure'],
];

const SAMPLE_ROWS = [
  { id: 1, date: '29 sept.', label: 'Courses de la semaine', category: 'Alimentation', amount: '−420 DH' },
  { id: 2, date: '30 sept.', label: 'Bourse d’études', category: 'Revenus', amount: '+1 500 DH' },
  { id: 3, date: '1 oct.', label: 'Abonnement téléphone', category: 'Factures', amount: '−99 DH' },
];
const SAMPLE_CHART = [
  { name: 'Lun', v: 3 }, { name: 'Mar', v: 5 }, { name: 'Mer', v: 2 }, { name: 'Jeu', v: 6 }, { name: 'Ven', v: 4 },
];

export default function DesignReference() {
  const [modal, setModal] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Référence du design</h1>
        <p className="text-mute text-sm mt-1">Page interne : les composants communs et les couleurs de VAUDAX. Tout nouvel écran les réutilise.</p>
      </div>

      <Card title="Couleurs">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {TOKENS.map(([v, name]) => (
            <div key={v} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg border border-line shrink-0" style={{ background: `var(${v})` }} />
              <div className="min-w-0">
                <div className="text-sm">{name}</div>
                <code className="text-[11px] text-mute">{v}</code>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Typographie">
        <div className="space-y-2">
          <div className="font-display text-3xl">Titre de page (Cormorant Garamond)</div>
          <p className="text-sm">Texte d’interface (Alegreya Sans) : lisible en petite taille.</p>
          <p className="font-data text-lg">Chiffres : 08:25 · 1 732 DH · 30 %</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Statistique chiffrée" value="1 732 DH" sub="police des chiffres" />
        <Stat label="Statistique texte" value="En cours" />
        <Stat label="Avec couleur" value="+12 %" color="var(--success)" />
        <Stat label="Nombre" value={42} sub="sur 50" />
      </div>

      <Card title="Boutons et pastilles">
        <div className="flex flex-wrap items-center gap-3">
          <Button><span className="flex items-center gap-2"><Plus size={16} /> Principal</span></Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="danger">Supprimer</Button>
          <Button disabled>Désactivé</Button>
          <IconButton label="Modifier"><Pencil size={15} /></IconButton>
          <IconButton label="Supprimer" tone="danger"><Trash2 size={15} /></IconButton>
          <Badge>Accent</Badge>
          <Badge color="var(--success)">Validé</Badge>
          <Badge color="var(--warning)">À surveiller</Badge>
          <Badge color="var(--error)">En retard</Badge>
        </div>
      </Card>

      <Card title="Formulaire et fenêtre">
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <Field label="Texte" hint="Une aide courte sous le champ."><Input placeholder="ex. Courses" /></Field>
          <Field label="Liste"><Select options={['Option A', 'Option B']} /></Field>
          <Field label="Progression"><div className="pt-3"><ProgressBar value={65} /></div></Field>
        </div>
        <Button variant="secondary" onClick={() => setModal(true)}>Ouvrir une fenêtre</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="Fenêtre">
          <p className="text-sm text-mute mb-4">Fenêtre centrée sur ordinateur, panneau par le bas sur téléphone. Échap la ferme.</p>
          <div className="flex justify-end"><Button onClick={() => setModal(false)}>Fermer</Button></div>
        </Modal>
      </Card>

      <Card title="Validation">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={done ? 'Décocher' : 'Cocher'}
            onClick={(e) => { if (!done) playSeal(e.currentTarget); setDone(!done); }}
            className="ui-icon-btn rounded-full flex items-center justify-center text-accent cursor-pointer"
          >
            {done ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-mute" />}
          </button>
          <span className="text-sm text-mute">L’unique animation de validation (habitude faite, cours pointé, semaine close).</span>
        </div>
      </Card>

      <Card title="Tableau (cartes sur téléphone)">
        <DataTable
          rows={SAMPLE_ROWS}
          columns={[
            { key: 'label', label: 'Libellé' },
            { key: 'date', label: 'Date' },
            { key: 'category', label: 'Catégorie' },
            { key: 'amount', label: 'Montant', align: 'right', render: (r) => <span className="font-data">{r.amount}</span> },
          ]}
        />
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Graphique">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={SAMPLE_CHART}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis allowDecimals={false} tick={axisTick} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="v" name="Séances" radius={[4, 4, 0, 0]} fill={SERIES[0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="État vide">
          <EmptyState icon={Inbox} action={<Button>Ajouter le premier</Button>}>Rien ici pour l’instant.</EmptyState>
        </Card>
      </div>
    </div>
  );
}
