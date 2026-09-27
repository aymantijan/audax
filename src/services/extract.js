import { supabase, isSupabaseConfigured } from './supabase';

const MAX_SIDE = 1800;
const MAX_PDF_BYTES = 3_500_000;

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// Photos are shrunk to at most 1800 px and re-encoded as JPEG so the upload
// stays well under the server limit; PDFs are sent as they are (max 3.5 MB).
export async function fileToPayload(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw Object.assign(new Error('too_large'), { code: 'too_large' });
    return { mimeType: 'application/pdf', data: await toBase64(file) };
  }
  if (!file.type.startsWith('image/')) throw Object.assign(new Error('bad_file'), { code: 'bad_file' });
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return { mimeType: 'image/jpeg', data: await toBase64(blob) };
}

// Sends a photo/PDF of a timetable to /api/extract-timetable; resolves with
// import-format text lines to review. Errors carry the same codes as the assistant.
export async function extractTimetable(file) {
  const payload = await fileToPayload(file);
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res;
  try {
    res = await fetch('/api/extract-timetable', { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch {
    throw Object.assign(new Error('offline'), { code: 'offline' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = res.status === 401 ? 'auth' : res.status === 404 ? 'not_configured' : res.status === 413 ? 'too_large' : body.error || 'failed';
    throw Object.assign(new Error(code), { code });
  }
  return body.text || '';
}

export const EXTRACT_ERRORS = {
  too_large: 'Fichier trop lourd : prends une photo plus petite ou un PDF de moins de 3,5 Mo.',
  bad_file: 'Format non pris en charge : photo (JPEG, PNG) ou PDF.',
};
