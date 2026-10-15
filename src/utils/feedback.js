// « Une idée, un problème ? » (chantier 8, D4): the ready e-mail, opened in
// the person's own mail app. Owner's choice (2026-10-15): messages arrive by
// e-mail at this address, also named in the privacy page.
export const FEEDBACK_EMAIL = 'tijan7609@gmail.com';

export function feedbackMailto({ kind, message, path, userAgent = '', version = 'dev' }) {
  const subject = `VAUDAX · ${kind === 'bug' ? 'Problème' : 'Idée'}`;
  const device = /iPhone|iPad/.test(userAgent) ? 'iPhone/iPad' : /Android/.test(userAgent) ? 'Android' : /Mac/.test(userAgent) ? 'Mac' : /Windows/.test(userAgent) ? 'Windows' : 'autre';
  const body = `${message.trim()}\n\n---\nÉcran : ${path}\nAppareil : ${device}\nVersion : ${version}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
