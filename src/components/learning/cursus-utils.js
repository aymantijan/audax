// Form helper shared by the curriculum windows: '' or null → null, '12,5' → 12.5.
export const numOrNull = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
