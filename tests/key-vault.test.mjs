import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, activeKeyFor, saveKey } from '../api/_lib/key-vault.js';

process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret';

test('keys are encrypted (never stored in clear) and come back intact', () => {
  const enc = encryptSecret('AIzaSyExample1234');
  assert.ok(!enc.includes('AIzaSy'));
  assert.notEqual(enc, encryptSecret('AIzaSyExample1234')); // random IV each time
  assert.equal(decryptSecret(enc), 'AIzaSyExample1234');
});

test('another server secret cannot read them', () => {
  const enc = encryptSecret('secret-key-value');
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'rotated';
  assert.throws(() => decryptSecret(enc));
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret';
});

test('the account key in use is found and decrypted for the AI endpoints', async () => {
  const secret = encryptSecret('sk-ant-abcdef1234');
  const fetchImpl = async (url) => {
    assert.match(url, /ai_keys\?user_id=eq\.u1&active=is\.true/);
    return new Response(JSON.stringify([{ provider: 'claude', secret, model: '' }]));
  };
  assert.deepEqual(await activeKeyFor('u1', { fetchImpl }), { provider: 'claude', key: 'sk-ant-abcdef1234', model: null });
  assert.equal(await activeKeyFor('local'), null);
});

test('saving stores only the ciphertext and the last 4 characters', async () => {
  let row;
  const fetchImpl = async (url, init = {}) => {
    if (init.method === 'POST') { row = JSON.parse(init.body); return new Response('', { status: 201 }); }
    return new Response('[]');
  };
  const r = await saveKey('u1', 'gemini', '  AIzaSyExample9876 ', '', { fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(row.last4, '9876');
  assert.equal(row.active, true); // first key becomes the one in use
  assert.ok(!JSON.stringify(row).includes('AIzaSyExample'));
  assert.equal(decryptSecret(row.secret), 'AIzaSyExample9876');
});
