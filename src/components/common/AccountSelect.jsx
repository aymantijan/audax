import { Select } from './ui';
import { CHART_OF_ACCOUNTS, ACCOUNT_CLASSES } from '../../utils/chart-of-accounts';

// Sélecteur de compte du plan comptable personnel, groupé par classe.
// `classes` restreint aux classes autorisées (ex : [5] pour la trésorerie).
export default function AccountSelect({ value, onChange, classes, ...props }) {
  const allowed = classes?.length ? CHART_OF_ACCOUNTS.filter((a) => classes.includes(a.cls)) : CHART_OF_ACCOUNTS;
  const byClass = {};
  for (const a of allowed) (byClass[a.cls] ??= []).push(a);
  return (
    <Select value={value} onChange={onChange} {...props}>
      {Object.entries(byClass).map(([cls, accounts]) => (
        <optgroup key={cls} label={`Classe ${cls} — ${ACCOUNT_CLASSES[cls].label}`}>
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} · {a.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
