import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useLearningStore } from '../src/store/learningStore.js';

test('recopier un semestre: same subjects and split, no grades, dates or ticks', () => {
  const s = useLearningStore;
  s.getState().resetAll();
  const t1 = s.getState().addTerm({ name: 'S1', startDate: '2026-09-01' });
  const m1 = s.getState().addModule({ termId: t1, name: 'Gestion' });
  s.setState({ courses: [{ id: 'c1', name: 'Compta', termId: t1, moduleId: m1, status: 'completed', folderUrl: 'https://drive.google.com/x', slots: [{ day: 1 }],
    evaluations: [{ id: 'e', name: 'Partiel', weight: 40, grade: 14, date: '2026-10-01' }],
    chapters: [{ id: 'ch', title: 'Bilan', checklistItems: [{ id: 'i', title: 'Exos', completed: true }] }] }] });
  const r = s.getState().duplicateTerm(t1, 'S2');
  assert.equal(r.courses, 1);
  const { courses, academic } = s.getState();
  const copy = courses.find((c) => c.termId === r.termId);
  assert.equal(copy.name, 'Compta');
  assert.equal(copy.status, 'active');
  assert.notEqual(copy.moduleId, m1);
  assert.ok(academic.modules.some((m) => m.id === copy.moduleId && m.termId === r.termId));
  assert.deepEqual([copy.evaluations[0].name, copy.evaluations[0].weight, copy.evaluations[0].grade, copy.evaluations[0].date], ['Partiel', 40, null, '']);
  assert.equal(copy.chapters[0].checklistItems[0].completed, false);
  assert.deepEqual([copy.slots.length, copy.folderUrl], [0, null]);
  assert.equal(academic.settings.activeTermId, r.termId);
});
