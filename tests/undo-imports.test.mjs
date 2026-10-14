// Guard (chantier 2): a screen that calls deleteWithUndo must import it. The
// build cannot see a missing import of a plain function — the button would
// only fail when tapped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : [];
});

test('every file using deleteWithUndo imports it', () => {
  const missing = files('src').filter((p) => {
    const s = readFileSync(p, 'utf8');
    return /deleteWithUndo\(/.test(s) && !/import \{[^}]*\bdeleteWithUndo\b[^}]*\} from/.test(s) && !/export function deleteWithUndo/.test(s);
  });
  assert.deepEqual(missing, []);
});
