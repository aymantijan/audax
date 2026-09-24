// One-page-style CV from careerStore.profile (Carrière n°1). Plain, ATS-friendly
// layout (text, not images): name, headline, contact line, summary, then
// Expériences / Formation / Certifications / Compétences / Langues.

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** 'YYYY-MM' → 'sept. 2026' ('' if empty). */
export const fmtMonth = (ym) => {
  const m = String(ym || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const period = (x) => (x.date ? fmtMonth(x.date) : [fmtMonth(x.start), x.current ? 'aujourd’hui' : fmtMonth(x.end)].filter(Boolean).join(' – '));
const byStartDesc = (list) => [...(list || [])].sort((a, b) => String(b.start || b.date || '').localeCompare(String(a.start || a.date || '')));

const INK = [26, 30, 40];
const MUTE = [110, 118, 130];
const ACCENT = [0, 140, 179];

export async function exportCvPDF(profile, name) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 18; const R = 192; const W = R - L;
  let y = 20;
  const need = (h) => { if (y + h > 282) { doc.addPage(); y = 20; } };
  const text = (str, { size = 10, color = INK, bold = false, x = L, width = W, gap = 4.6 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(str), width);
    for (const line of lines) { need(gap); doc.text(line, x, y); y += gap; }
  };
  const heading = (label) => {
    need(14); y += 3;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ACCENT);
    doc.text(label.toUpperCase(), L, y); y += 1.8;
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 5;
  };
  const entry = (title, right, sub, body) => {
    need(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(title, W - 45)[0], L, y);
    if (right) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(right, R, y, { align: 'right' }); }
    y += 4.8;
    if (sub) text(sub, { size: 9, color: MUTE, gap: 4.2 });
    if (body) for (const line of String(body).split('\n').map((l) => l.trim()).filter(Boolean)) text(`• ${line.replace(/^[-•]\s*/, '')}`, { size: 9.5, x: L + 2, width: W - 2, gap: 4.4 });
    y += 2.5;
  };

  text(name || 'Nom Prénom', { size: 20, bold: true, gap: 8 });
  if (profile.headline) text(profile.headline, { size: 11.5, color: ACCENT, gap: 6 });
  const contact = [profile.location, profile.email, profile.phone, ...(profile.links || []).map((l) => l.url.replace(/^https?:\/\//, ''))].filter(Boolean).join('  ·  ');
  if (contact) text(contact, { size: 9, color: MUTE, gap: 4.4 });
  if (profile.summary) { y += 2; text(profile.summary, { size: 10, gap: 4.8 }); }

  if ((profile.experiences || []).length) {
    heading('Expériences');
    for (const x of byStartDesc(profile.experiences)) entry(`${x.title} — ${x.org}`, period(x), [x.type, x.location].filter(Boolean).join(' · '), x.description);
  }
  if ((profile.education || []).length) {
    heading('Formation');
    for (const x of byStartDesc(profile.education)) entry(`${x.degree} — ${x.school}`, period(x), x.field, x.notes);
  }
  if ((profile.certifications || []).length) {
    heading('Certifications');
    for (const x of byStartDesc(profile.certifications)) entry(x.name, period(x), x.issuer, '');
  }
  if ((profile.skills || []).length) { heading('Compétences'); text(profile.skills.join('  ·  '), { size: 10 }); }
  if ((profile.languages || []).length) { heading('Langues'); text(profile.languages.map((l) => `${l.name} (${l.level})`).join('  ·  '), { size: 10 }); }

  const file = `CV-${(name || 'audax').replace(/\s+/g, '-')}.pdf`;
  doc.save(file);
  return file;
}
