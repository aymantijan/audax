import { supabase, isSupabaseConfigured } from './supabase';

// Password policy from the spec: min 12 chars, upper + lower + number + special.
export function validatePasswordStrength(pw) {
  if (!pw || pw.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
  if (!/[A-Z]/.test(pw)) return 'Ajoute une majuscule.';
  if (!/[a-z]/.test(pw)) return 'Ajoute une minuscule.';
  if (!/[0-9]/.test(pw)) return 'Ajoute un chiffre.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Ajoute un caractère spécial (par exemple ! ou #).';
  return null;
}

const notConfigured = { error: 'Cloud auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };

// Register. Supabase hashes the password (bcrypt) server-side and sends the
// verification email automatically. Profile fields ride along in user_metadata.
export async function register({ email, password, fullName, gender }) {
  if (!isSupabaseConfigured) return notConfigured;
  const strength = validatePasswordStrength(password);
  if (strength) return { error: strength };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, gender }, emailRedirectTo: `${window.location.origin}/welcome` },
  });
  if (error) return { error: error.message };
  return { user: data.user, needsVerification: !data.session, message: 'Vérifie ta boîte e-mail pour confirmer ton compte.' };
}

// Login. Returns a session (JWT + refresh token) the SDK persists & auto-rotates.
export async function login({ email, password }) {
  if (!isSupabaseConfigured) return notConfigured;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou mot de passe incorrect.' }; // don't reveal whether the email exists
  return { user: data.user, session: data.session };
}

// Password reset request — sends the email. Always resolves the same way (no enumeration).
export async function requestPasswordReset(email) {
  if (!isSupabaseConfigured) return notConfigured;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/welcome` });
  return { message: 'Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé.' };
}

// Set a new password (used after the reset-email link establishes a recovery session).
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured) return notConfigured;
  const strength = validatePasswordStrength(newPassword);
  if (strength) return { error: strength };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { error: error.message } : { message: 'Password updated.' };
}

// ---- Two-factor (TOTP authenticator app) via Supabase MFA ----
export async function enroll2FA() {
  if (!isSupabaseConfigured) return notConfigured;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) return { error: error.message };
  // data.totp.qr_code is an SVG data-URI to display for the authenticator app
  return { factorId: data.id, qrCode: data.totp?.qr_code, secret: data.totp?.secret };
}

export async function verify2FA(factorId, code) {
  if (!isSupabaseConfigured) return notConfigured;
  const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr) return { error: cErr.message };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: chal.id, code });
  return error ? { error: error.message } : { message: '2FA verified.' };
}

export async function logout() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
