import { supabase, isSupabaseConfigured } from './supabase';
import { aiKeyHeaders } from '../store/aiKeyStore';

// Headers for every AI call: JSON, the sign-in token, and the person's own
// AI key when they added one (Paramètres → Assistant).
export async function aiRequestHeaders() {
  const headers = { 'Content-Type': 'application/json', ...aiKeyHeaders() };
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
