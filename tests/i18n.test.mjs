// Languages (chantier 6b): every French text shown through t() on the
// translated screens has its English, Spanish and Arabic version, with the same
// {blanks}. Run `node tests/i18n.test.mjs --list` to print what is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MODULES, POLES } from '../src/utils/navigation.js';
import { AIMS, SITUATIONS, COUNTRIES, GOAL_TEMPLATES, buildOnboardingPlan } from '../src/utils/onboarding-plan.js';
import { HELP, TOUR } from '../src/utils/help.js';
import { TEXT_SIZES } from '../src/utils/display.js';
import { CURRENCIES } from '../src/utils/currency.js';
import { HABIT_CATEGORY_LABELS } from '../src/utils/constants.js';
import { REVIEW_METRICS } from '../src/utils/life-review.js';
import { HABIT_HINTS } from '../src/utils/module-nudges.js';
import { PUBLIC_LINKS, PILLARS, FOR_WHOM, PROMISES, INSTALL_STEPS } from '../src/utils/landing-content.js';
import { translate, fill } from '../src/i18n/index.js';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';
import ar from '../src/i18n/ar.js';

// Texts passed to t() as variables (data lists, server messages).
const EXTRA = [
  'Simple', 'Expert',
  'L’essentiel, en mots de tous les jours : cocher, noter, voir ta semaine.',
  'Tous les outils : compétences, chronologie, défis, analyses, comptabilité, termes techniques expliqués au toucher.',
  'Le mot de passe doit contenir au moins 12 caractères.', 'Ajoute une majuscule.', 'Ajoute une minuscule.', 'Ajoute un chiffre.',
  'Ajoute un caractère spécial (par exemple ! ou #).', 'Vérifie ta boîte e-mail pour confirmer ton compte.',
  'E-mail ou mot de passe incorrect.', 'Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé.',
  'j', 'sem.',
  'iPhone / iPad', 'Android', 'Ordinateur',
];

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(js|jsx)$/.test(f) && !p.includes(`i18n${process.platform === 'win32' ? '\\' : '/'}`) ? [p] : [];
  });
}

export function allKeys() {
  const keys = new Set(EXTRA);
  for (const f of files('src')) {
    const s = readFileSync(f, 'utf8');
    if (!/from '[./]*i18n(\/index\.js)?'/.test(s)) continue; // only files that use the translator (others may have their own t)
    for (const m of s.matchAll(/(?<![\w.$])t\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
    for (const m of s.matchAll(/(?<![\w.$])tn\([^,]+,\s*'([^']*)',\s*'([^']*)'/g)) { keys.add(m[1]); keys.add(m[2]); }
  }
  const onboardingHabits = buildOnboardingPlan({ aims: AIMS.map((a) => a.key) }).habits;
  for (const x of [
    ...Object.values(MODULES).map((m) => m.label), ...POLES.flatMap((p) => [p.label, p.short]),
    ...AIMS.map((a) => a.label), ...AIMS.flatMap((a) => a.habits || []), ...onboardingHabits,
    ...SITUATIONS.map((s) => s.label), ...COUNTRIES.map((c) => c.label), ...Object.values(GOAL_TEMPLATES).map((g) => g.label),
    ...Object.values(HELP).flatMap((h) => [h.title, ...h.lines]), ...TOUR.flatMap((s) => [s.title, s.text]),
    ...TEXT_SIZES.map((s) => s.label), ...CURRENCIES.map((c) => c.label), ...Object.values(HABIT_CATEGORY_LABELS),
    ...REVIEW_METRICS.map((m) => m.label), ...HABIT_HINTS.map((h) => h.text),
    ...PUBLIC_LINKS.map((l) => l.label), ...PILLARS.flatMap((p) => [p.title, p.text]), ...FOR_WHOM, ...PROMISES.map((p) => p.text), ...Object.values(INSTALL_STEPS).flat(),
  ]) keys.add(x);
  return [...keys].sort();
}

const blanks = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

if (process.argv.includes('--list')) {
  const keys = allKeys();
  const missing = { en: keys.filter((k) => !en[k]), es: keys.filter((k) => !es[k]), ar: keys.filter((k) => !ar[k]) };
  console.log(JSON.stringify({ total: keys.length, missing }, null, 1));
}

test('t() fills blanks and falls back to French', () => {
  assert.equal(fill('Bonjour, {name}', { name: 'Ana' }), 'Bonjour, Ana');
  assert.equal(translate(null, 'Bonjour, {name}', { name: 'Ana' }), 'Bonjour, Ana');
  assert.equal(translate({ 'Bonjour, {name}': 'Hello, {name}' }, 'Bonjour, {name}', { name: 'Ana' }), 'Hello, Ana');
});

for (const [lang, dict] of [['en', en], ['es', es], ['ar', ar]]) {
  test(`every text of the translated screens exists in ${lang}, with the same blanks`, () => {
    const keys = allKeys();
    const missing = keys.filter((k) => !dict[k]);
    assert.deepEqual(missing, [], `${missing.length} missing`);
    const wrong = keys.filter((k) => blanks(k) !== blanks(dict[k]));
    assert.deepEqual(wrong, []);
  });
}
