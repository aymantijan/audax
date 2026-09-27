// Slice of accountingStore.js (split mechanically, F3 — see scripts in the plan):
// section text moved verbatim, composed back in ../accountingStore.js.
import { uid } from '../../utils/formatters';
import { classOf, ACCOUNT_MAP, mergedAccountMap } from '../../utils/chart-of-accounts';
import { useSkillStore } from '../skillStore';
import { toast } from '../uiStore';
import { stamp, r2mul } from './helpers';

export const treasurySlice = (set, get) => ({
      // ─────────── Comptes auxiliaires de trésorerie ───────────
      // Un compte auxiliaire (ex: "CIH") est rattaché à un compte collectif de
      // classe 5 fixe (ex: "511" Compte bancaire courant) via son propre code
      // généré ("511-<uid>") — le chiffre de classe reste en tête donc classOf()
      // continue de le traiter comme un compte de trésorerie ordinaire partout
      // dans le moteur comptable ; seul le LIBELLÉ affiché doit passer par
      // getAccountMap() (voir mergedAccountMap dans chart-of-accounts.js).
      getAccountMap: () => mergedAccountMap(get().treasuryAccounts),

      addTreasuryAccount: ({ parentCode, name, bank, currency }) => {
        if (classOf(parentCode) !== 5) return { ok: false, error: 'Le compte auxiliaire doit être rattaché à un compte de trésorerie (classe 5).' };
        if (!name?.trim()) return { ok: false, error: 'Le nom du compte est requis.' };
        const account = {
          id: uid(), code: `${parentCode}-${uid()}`, parentCode, name: name.trim(), bank: bank?.trim() || '',
          currency: currency && currency !== get().baseCurrency ? currency : null,
          archived: false, createdAt: Date.now(), updatedAt: Date.now(),
        };
        set({ treasuryAccounts: [...get().treasuryAccounts, account] });
        // Was a real gap: treasury-planning-lv1 previously only ever got XP
        // from an achieved treasury goal (rare) — setting up how your money
        // is actually organized is itself treasury planning, not a footnote.
        useSkillStore.getState().awardXP('treasury-planning-lv1', 3, `compte auxiliaire créé : ${account.name}`);
        toast(`Compte auxiliaire créé : ${account.name}`, 'success');
        get().checkBadges();
        return { ok: true, code: account.code };
      },
      editTreasuryAccount: (id, updates) =>
        set({
          treasuryAccounts: get().treasuryAccounts.map((a) =>
            a.id === id ? stamp({ ...a, ...updates, name: updates.name != null ? updates.name.trim() : a.name }) : a
          ),
        }),
      archiveTreasuryAccount: (id) => {
        set({ treasuryAccounts: get().treasuryAccounts.map((a) => (a.id === id ? stamp({ ...a, archived: true }) : a)) });
        toast('Compte auxiliaire archivé', 'info');
      },
      unarchiveTreasuryAccount: (id) =>
        set({ treasuryAccounts: get().treasuryAccounts.map((a) => (a.id === id ? stamp({ ...a, archived: false }) : a)) }),
      // Suppression définitive seulement si le compte n'a aucune écriture —
      // sinon on archive (même logique que tradingStore.deleteAccount).
      deleteTreasuryAccount: (id) => {
        const acct = get().treasuryAccounts.find((a) => a.id === id);
        if (!acct) return { ok: false, error: 'Compte introuvable.' };
        const used = get().journal.some((e) => e.lines.some((l) => l.account === acct.code));
        if (used) return { ok: false, error: 'Ce compte a des écritures au journal — archivez-le plutôt que de le supprimer.' };
        set({ treasuryAccounts: get().treasuryAccounts.filter((a) => a.id !== id) });
        toast('Compte auxiliaire supprimé', 'info');
        return { ok: true };
      },

      // ─────────── Avoirs immobilisés (définitions, sans solde) ───────────
      // Même modèle que treasuryAccounts : une définition structurée par avoir,
      // rattachée à un sous-compte de classe 2. Le MONTANT reste au journal (coût
      // historique) ; ici on stocke la classification (assetClass, liquidityTier)
      // + les métadonnées de valorisation partagées avec Wealth OS. assetClass,
      // liquidityTier et valuationSource se déduisent du sous-compte choisi
      // (ACCOUNT_MAP) quand ils ne sont pas fournis, pour rester cohérents avec
      // le plan comptable. RÈGLE : AUDAX ne calcule aucun cours « live » —
      // pour un avoir market_live (or, métaux, actions) il n'expose que
      // quantity + unitCost + marketIdentifier ; Wealth OS applique le cours réel.
      addAsset: (data) => {
        if (!data.accountCode || classOf(data.accountCode) !== 2) {
          return { ok: false, error: 'Un avoir immobilisé doit être rattaché à un sous-compte de classe 2.' };
        }
        if (!data.label?.trim()) return { ok: false, error: "Le libellé de l'avoir est requis." };
        const meta = ACCOUNT_MAP[data.accountCode] || {};
        const qty = data.quantity != null && data.quantity !== '' ? Number(data.quantity) : null;
        const unitCost = data.unitCost != null && data.unitCost !== '' ? Number(data.unitCost) : null;
        const totalCost =
          data.totalCost != null && data.totalCost !== ''
            ? Number(data.totalCost)
            : qty != null && unitCost != null
              ? r2mul(qty, unitCost)
              : null;
        const asset = {
          id: uid(),
          accountCode: data.accountCode,
          assetClass: data.assetClass || meta.assetClass || 'autres',
          liquidityTier: data.liquidityTier || meta.liquidityTier || 3,
          label: data.label.trim(),
          quantity: qty,
          unit: data.unit?.trim() || null,
          unitCost,
          totalCost,
          acquisitionDate: data.acquisitionDate || null,
          valuationSource: data.valuationSource || meta.valuationSource || 'cost',
          marketIdentifier: data.marketIdentifier?.trim() || null,
          currentEstimate:
            data.currentEstimate != null && data.currentEstimate !== '' ? Number(data.currentEstimate) : null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ assets: [...get().assets, asset] });
        useSkillStore.getState().awardXP('financial-statements-lv1', 3, `avoir immobilisé défini : ${asset.label}`);
        toast(`Avoir immobilisé enregistré : ${asset.label}`, 'success');
        get().checkBadges();
        return { ok: true, id: asset.id };
      },
      editAsset: (id, updates) =>
        set({
          assets: get().assets.map((a) => {
            if (a.id !== id) return a;
            const next = { ...a, ...updates };
            // Recalcule totalCost si quantité/coût unitaire changent et qu'aucun
            // totalCost explicite n'est fourni dans cette mise à jour.
            if (updates.totalCost == null && (updates.quantity != null || updates.unitCost != null)) {
              const q = next.quantity != null && next.quantity !== '' ? Number(next.quantity) : null;
              const u = next.unitCost != null && next.unitCost !== '' ? Number(next.unitCost) : null;
              next.totalCost = q != null && u != null ? r2mul(q, u) : next.totalCost;
            }
            return stamp(next);
          }),
        }),
      deleteAsset: (id) => set({ assets: get().assets.filter((a) => a.id !== id) }),
});
