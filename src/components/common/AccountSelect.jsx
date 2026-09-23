import { Select } from './ui';
import { useAccountingStore } from '../../store/accountingStore';
import { CHART_OF_ACCOUNTS, ACCOUNT_CLASSES } from '../../utils/chart-of-accounts';

// Sélecteur de compte du plan comptable personnel, groupé par classe.
// `classes` restreint aux classes autorisées (ex : [5] pour la trésorerie).
// Chaque compte de trésorerie (classe 5) affiche aussi, juste en dessous,
// ses comptes auxiliaires (ex : "CIH" sous "511 · Compte bancaire courant") —
// un compte archivé reste listé s'il est la valeur courante (édition d'une
// écriture ancienne) pour ne pas faire "sauter" la sélection.
export default function AccountSelect({ value, onChange, classes, simple = false, ...props }) {
  const treasuryAccounts = useAccountingStore((s) => s.treasuryAccounts);
  const allowed = classes?.length ? CHART_OF_ACCOUNTS.filter((a) => classes.includes(a.cls)) : CHART_OF_ACCOUNTS;
  // Simple mode: plain names grouped by everyday category, no account codes.
  if (simple) {
    const groups = {};
    for (const a of allowed) {
      const g = a.group || ACCOUNT_CLASSES[a.cls].label;
      (groups[g] ??= []).push({ code: a.code, text: a.label });
      for (const sub of treasuryAccounts.filter((t) => t.parentCode === a.code && (!t.archived || t.code === value))) {
        groups[g].push({ code: sub.code, text: `↳ ${sub.name}${sub.archived ? ' (archivé)' : ''}` });
      }
    }
    return (
      <Select value={value} onChange={onChange} {...props}>
        {Object.entries(groups).map(([g, accounts]) => (
          <optgroup key={g} label={g}>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.text}</option>)}
          </optgroup>
        ))}
      </Select>
    );
  }
  const byClass = {};
  for (const a of allowed) {
    (byClass[a.cls] ??= []).push({ code: a.code, text: `${a.code} · ${a.label}` });
    for (const sub of treasuryAccounts.filter((t) => t.parentCode === a.code && (!t.archived || t.code === value))) {
      byClass[a.cls].push({ code: sub.code, text: `↳ ${sub.name}${sub.archived ? ' (archivé)' : ''}` });
    }
  }
  return (
    <Select value={value} onChange={onChange} {...props}>
      {Object.entries(byClass).map(([cls, accounts]) => (
        <optgroup key={cls} label={`Classe ${cls} — ${ACCOUNT_CLASSES[cls].label}`}>
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>
              {a.text}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
