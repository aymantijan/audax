import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILIES, FAMILY_MAP, MODELS, CUTOVER, familyIdOf, entryNodeOf, skillLabel,
  computeFamilyStates, visibleFamilyIds, nextRequirementText, newlyAvailable, DEFAULT_MODELS,
} from '../src/utils/skill-families.js';
import { SKILL_TREE } from '../src/utils/skill-tree-data.js';

const AFTER = CUTOVER + 86400000;
const log = (n, amount, date = AFTER) => Array.from({ length: n }, (_, i) => ({ date: date + i, amount, source: 'course: X' }));
const node = (xpLog, extra = {}) => ({ xpLog, level: 1, xp: 0, ...extra });

test('chains fold into one family; every node belongs to exactly one family', () => {
  const dcf = FAMILY_MAP['dcf-analysis'];
  assert.deepEqual(dcf.nodes, ['dcf-analysis-lv1', 'dcf-analysis-lv2', 'dcf-analysis-lv3']);
  assert.equal(FAMILIES.reduce((a, f) => a + f.nodes.length, 0), SKILL_TREE.length);
  assert.equal(familyIdOf('dcf-analysis-lv2'), 'dcf-analysis');
  assert.equal(entryNodeOf('dcf-analysis'), 'dcf-analysis-lv1');
  assert.equal(skillLabel('dcf-analysis-lv3'), 'Analyse DCF');
});

test('every non-Trading family has a French name; every family has a known model', () => {
  const ids = new Set(MODELS.map((m) => m.id));
  for (const f of FAMILIES) {
    assert.ok(ids.has(f.model), `${f.id} → ${f.model}`);
    if (f.model !== 'trading') assert.ok(!/ Lv\d/.test(f.name) && f.name, f.id);
  }
  assert.ok(!FAMILIES.some((f) => f.prereqs.includes(f.id)), 'no self prereq');
});

test('a level needs points AND separate activities', () => {
  // 60 points in a single activity: level 1 only (level 2 needs 3 activities)
  let st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node(log(1, 60)) } });
  assert.equal(st['dcf-analysis'].level, 1);
  st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node(log(3, 20)) } });
  assert.equal(st['dcf-analysis'].level, 2);
});

test('XP spread over the chain nodes adds up', () => {
  const st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node(log(5, 20)), 'dcf-analysis-lv2': node(log(5, 20)) } });
  assert.equal(st['dcf-analysis'].points, 200);
  assert.equal(st['dcf-analysis'].level, 3);
});

test('level 4 is capped until a proof exists', () => {
  const skills = { 'dcf-analysis-lv1': node(log(20, 20)) }; // 400 pts, 20 activities
  let st = computeFamilyStates({ skills });
  assert.equal(st['dcf-analysis'].level, 3);
  assert.equal(st['dcf-analysis'].capped, true);
  assert.match(nextRequirementText(st['dcf-analysis']), /preuve/);
  st = computeFamilyStates({ skills, proofs: { 'dcf-analysis': [{ id: 'p', kind: 'exam', title: 'Exam' }] } });
  assert.equal(st['dcf-analysis'].level, 4);
});

test('points earned before the cutover are honoured on points alone', () => {
  const st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node([{ date: CUTOVER - 1000, amount: 700, source: 'old' }]) } });
  assert.equal(st['dcf-analysis'].level, 5);
});

test('manual acquisitions keep level 2; mastery never goes down', () => {
  let st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node([], { manualAcquired: true }) } });
  assert.equal(st['dcf-analysis'].level, 2);
  st = computeFamilyStates({ skills: {}, mastery: { 'dcf-analysis': 4 } });
  assert.equal(st['dcf-analysis'].level, 4);
  assert.equal(st['dcf-analysis'].status, 'active');
});

test('dependents open when every prerequisite family reaches level 2', () => {
  const fam = FAMILIES.find((f) => f.prereqs.length === 1 && FAMILY_MAP[f.prereqs[0]].prereqs.length === 0);
  const before = computeFamilyStates({ skills: {} });
  assert.equal(before[fam.id].status, 'locked');
  const p = FAMILY_MAP[fam.prereqs[0]];
  const after = computeFamilyStates({ skills: { [p.nodes[0]]: node(log(3, 20)) } });
  assert.equal(after[fam.id].status, 'available');
  assert.ok(newlyAvailable(before, after).includes(fam.id));
});

test('visible families: active models + practised + linked', () => {
  const st = computeFamilyStates({ skills: { 'dcf-analysis-lv1': node(log(1, 5)) } });
  const ids = new Set(visibleFamilyIds(st, DEFAULT_MODELS, new Set(['vc-thesis'])));
  assert.ok(ids.has('dcf-analysis'));       // practised (model "finance" is off)
  assert.ok(ids.has('vc-thesis'));          // linked
  assert.ok(ids.has('reading-habit'));      // default model "lecture"
  assert.ok(!ids.has('isc-fiscalite'));     // ISCAE model is off by default
});
