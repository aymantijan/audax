-- 009 · Personal AI keys, one per provider and per account, so a key entered
-- on one device works on all of them. Keys are stored ENCRYPTED by the server
-- (AES-256-GCM, api/_lib/key-vault.js); this table has RLS on and no policy at
-- all, so only the server (service role) can read or write it — never a browser.
create table if not exists public.ai_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'claude', 'openai', 'openrouter')),
  secret text not null,          -- base64(iv | tag | ciphertext)
  last4 text not null default '',
  model text not null default '',
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.ai_keys enable row level security;
revoke all on public.ai_keys from anon, authenticated;
