// Course material lives where it already is (chantier 9): a Drive / OneDrive /
// Dropbox folder, a PDF, a video… VAUDAX keeps links, recognises the service,
// and reads lists pasted in one go. Pure: tests/links.test.mjs.

const PROVIDERS = [
  { key: 'gdrive', label: 'Google Drive', re: /(^|\.)drive\.google\.com$/ },
  { key: 'gdocs', label: 'Google Docs', re: /(^|\.)docs\.google\.com$/ },
  { key: 'onedrive', label: 'OneDrive', re: /(^|\.)(onedrive\.live\.com|1drv\.ms|sharepoint\.com)$/ },
  { key: 'dropbox', label: 'Dropbox', re: /(^|\.)dropbox\.com$/ },
  { key: 'icloud', label: 'iCloud', re: /(^|\.)icloud\.com$/ },
  { key: 'notion', label: 'Notion', re: /(^|\.)(notion\.so|notion\.site)$/ },
  { key: 'classroom', label: 'Google Classroom', re: /(^|\.)classroom\.google\.com$/ },
  { key: 'teams', label: 'Teams', re: /(^|\.)teams\.(microsoft|live)\.com$/ },
  { key: 'moodle', label: 'Moodle', re: /moodle/ },
  { key: 'youtube', label: 'YouTube', re: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { key: 'github', label: 'GitHub', re: /(^|\.)github\.com$/ },
];

// "drive.google.com/…" or "www.x.com" → https://…; anything else unchanged.
export function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`;
  return s;
}

export const isUrl = (s) => { try { const u = new URL(normalizeUrl(s)); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };

// → { provider, label, type, name } — type follows RESOURCE_TYPES (utils/tracks.js).
export function detectLink(raw) {
  const url = normalizeUrl(raw);
  let u;
  try { u = new URL(url); } catch { return { provider: 'web', label: 'Lien', type: 'link', name: '' }; }
  const host = u.hostname.toLowerCase();
  const file = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
  const pdf = /\.pdf$/i.test(u.pathname);
  const p = PROVIDERS.find((x) => x.re.test(host));
  const name = /\.[a-z0-9]{2,5}$/i.test(file) ? file.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ') : '';
  if (p) return { provider: p.key, label: p.label, type: p.key === 'youtube' ? 'video' : 'link', name, folder: /\/folders?\//.test(u.pathname) || /folder|redir/.test(u.search + u.pathname) };
  if (pdf) return { provider: 'pdf', label: 'PDF', type: 'article', name };
  return { provider: 'web', label: host.replace(/^www\./, ''), type: 'link', name };
}

// One link per line: "Titre | lien", "Titre : lien", "Titre lien" or just "lien".
export function parseLinkLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/(https?:\/\/\S+|\b[\w-]+(\.[\w-]+)+\/\S*)/i);
      if (!m) return null;
      const url = normalizeUrl(m[0].replace(/[),.;]+$/, ''));
      const title = line.replace(m[0], '').replace(/^[\s\-–—•*|:]+|[\s\-–—|:]+$/g, '').trim();
      const d = detectLink(url);
      return { url, title: title || d.name || d.label, type: d.type, provider: d.provider };
    })
    .filter(Boolean);
}

// A pasted course plan → chapters with tasks. A line starting with "-", "•",
// "*", "–" or an indent is a task of the chapter above; any other line is a
// chapter. "1.", "I." or "Chapitre 2 :" prefixes are kept as typed. A link in
// a line is kept on the chapter or task (url).
export function parseProgramme(text) {
  const chapters = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const task = /^(\s{2,}|\t)/.test(raw) || /^\s*[-•*–]\s+/.test(raw);
    const m = raw.match(/https?:\/\/\S+/i);
    const url = m ? m[0].replace(/[),.;]+$/, '') : '';
    const title = raw.replace(m ? m[0] : '', '').replace(/^\s*[-•*–]\s+/, '').replace(/[\s|:–-]+$/, '').trim();
    if (!title && !url) continue;
    if (task && chapters.length) chapters[chapters.length - 1].items.push({ title: title || detectLink(url).label, url });
    else chapters.push({ title: title || detectLink(url).label, url, items: [] });
  }
  return chapters;
}
