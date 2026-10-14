// UI guards (chantier 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.jsx?$/.test(f) ? [p] : [];
});

// The theme defines a colour named `base` (the page background), so Tailwind's
// `text-base` paints text in the background colour instead of sizing it.
test('no ambiguous text-base class (use text-[1rem])', () => {
  const bad = files('src').filter((p) => /(?<![\w-])text-base(?![\w-])/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(bad, []);
});

// Text sizes in px do not follow Paramètres → Affichage → Taille du texte.
test('no pixel text sizes (rem only, so the text-size setting applies)', () => {
  const bad = files('src').filter((p) => /text-\[\d+px\]/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(bad, []);
});
