// Grading engine: level pass marks (ISCAE 7/8/10), legacy single mark, retake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termResult, subjectResult, requiredGrade, GRADING_PRESETS, DEFAULT_ACADEMIC_SETTINGS } from '../src/utils/academic.js';

const ISCAE = { ...DEFAULT_ACADEMIC_SETTINGS, ...GRADING_PRESETS.find((p) => p.key === 'iscae').settings };
const LEGACY = { ...DEFAULT_ACADEMIC_SETTINGS };
const ev = (type, weight, grade) => ({ id: type, type, weight, grade });
const subj = (id, moduleId, g, coefficient = 1) => ({ id, kind: 'academic', termId: 't', moduleId, coefficient, status: 'active', evaluations: [ev('cc', 30, g), ev('cf', 30, g), ev('tass', 40, g)] });
const modules = [{ id: 'm1', termId: 't', coefficient: 1 }, { id: 'm2', termId: 't', coefficient: 1 }];

test('ISCAE: a subject under 7 fails its module and the semester, even with average ≥ 10', () => {
  const r = termResult('t', modules, [subj('a', 'm1', 12), subj('b', 'm1', 6.5), subj('c', 'm2', 12)], ISCAE);
  assert.equal(r.units[0].status, 'failed');
  assert.ok(r.avg >= 10);
  assert.equal(r.status, 'failed');
});

test('ISCAE: modules at 8–9 are validated but the semester needs 10', () => {
  const r = termResult('t', modules, [subj('a', 'm1', 9), subj('b', 'm1', 8), subj('c', 'm2', 9)], ISCAE);
  assert.deepEqual(r.units.map((u) => u.status), ['validated', 'validated']);
  assert.equal(r.status, 'failed');
});

test('ISCAE: subject at 7.5 compensated inside a module, semester ≥ 10 → validated', () => {
  const r = termResult('t', modules, [subj('a', 'm1', 12), subj('b', 'm1', 7.5), subj('c', 'm2', 12)], ISCAE);
  assert.equal(r.status, 'validated');
});

test('ISCAE: a module under 8 blocks the semester', () => {
  const r = termResult('t', modules, [subj('a', 'm1', 7.5), subj('b', 'm1', 7.5), subj('c', 'm2', 14)], ISCAE);
  assert.equal(r.units[0].status, 'failed');
  assert.equal(r.status, 'failed');
});

// Legacy single pass mark: module compensation still works, but since the
// 2026-09-27 decision a subject under the eliminatory mark blocks the semester.
test('legacy single pass mark: compensation, and an eliminatory subject blocks the semester', () => {
  const run = (g) => termResult('t', modules, [subj('a', 'm1', g[0]), subj('b', 'm1', g[1]), subj('c', 'm2', g[2])], LEGACY);
  assert.deepEqual([run([12, 9, 12]).status, run([12, 9, 12]).units.map((u) => u.status).join()], ['validated', 'validated,validated']);
  assert.deepEqual([run([12, 4, 16]).status, run([12, 4, 16]).units[0].status], ['failed', 'failed']); // 4 < eliminatory 5
  assert.equal(run([12, 6, 16]).status, 'validated'); // 6 ≥ 5: compensated
});

test('retake is triggered and capped at the subject pass mark', () => {
  const c = { ...subj('a', 'm1', 5), retakeGrade: 15 };
  assert.equal(subjectResult(c, ISCAE).final, 7);
  assert.equal(subjectResult({ ...subj('a', 'm1', 8), retakeGrade: 15 }, ISCAE).final, 8); // already ≥ 7: no retake
});

test('requiredGrade on remaining evaluations', () => {
  const c = { evaluations: [ev('cc', 30, 14), ev('cf', 30, null), ev('tass', 40, null)] };
  const req = requiredGrade(c, 10, ISCAE);
  assert.equal(req.status, 'possible');
  assert.equal(req.needed, 8.29);
});
