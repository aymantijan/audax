import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useSkillStore } from '../../store/skillStore';
import { toCSV, parseCSV, downloadCSV } from '../../utils/csv';
import { courseSchema, validate } from '../../utils/validators';
import { GRADES, SKILL_MAP } from '../../utils/constants';
import { Button } from '../common/ui';
import { toast } from '../../store/uiStore';

// One row per chapter checklist item — course-level fields (name, institution,
// credits, …) are repeated on every row of a course; rows are grouped back
// into one course per distinct `name`, chapters grouped back per distinct
// `chapterTitle` within that course, both in first-seen order. A course with
// no chapters at all is just a single row with chapterTitle/itemTitle blank.
// linkedSkills is a single column of skill ids/names joined with ";".
const COLUMNS = [
  { key: 'name', label: 'name' },
  { key: 'institution', label: 'institution' },
  { key: 'professor', label: 'professor' },
  { key: 'credits', label: 'credits' },
  { key: 'expectedGrade', label: 'expectedGrade' },
  { key: 'progressPercent', label: 'progressPercent' },
  { key: 'linkedSkills', label: 'linkedSkills' },
  { key: 'chapterTitle', label: 'chapterTitle' },
  { key: 'chapterCoefficient', label: 'chapterCoefficient' },
  { key: 'itemTitle', label: 'itemTitle' },
  { key: 'itemCoefficient', label: 'itemCoefficient' },
];

function courseRows(c) {
  const linkedSkills = (c.linkedSkills || []).join(';');
  const base = { name: c.name, institution: c.institution, professor: c.professor, credits: c.credits, expectedGrade: c.expectedGrade, progressPercent: c.progressPercent ?? 0, linkedSkills };
  if (!c.chapters?.length) return [{ ...base, chapterTitle: '', chapterCoefficient: '', itemTitle: '', itemCoefficient: '' }];
  return c.chapters.flatMap((ch) =>
    ch.checklistItems?.length
      ? ch.checklistItems.map((it) => ({ ...base, chapterTitle: ch.title, chapterCoefficient: ch.coefficient, itemTitle: it.title, itemCoefficient: it.coefficient }))
      : [{ ...base, chapterTitle: ch.title, chapterCoefficient: ch.coefficient, itemTitle: '', itemCoefficient: '' }]
  );
}

// Groups flat CSV rows back into course objects with nested chapters/checklistItems,
// preserving first-seen order for both courses and chapters within a course.
function rowsToCourses(rows, skillsById, skillsByName) {
  const courses = new Map(); // name -> { data, chapters: Map(title -> {coefficient, items[]}) }
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    if (!courses.has(name)) {
      const linkedSkills = (row.linkedSkills || '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (skillsById.has(s) ? s : skillsByName.get(s.toLowerCase())))
        .filter(Boolean);
      courses.set(name, {
        data: {
          name,
          institution: row.institution?.trim() || '',
          professor: row.professor?.trim() || '',
          credits: row.credits,
          expectedGrade: GRADES.includes(row.expectedGrade?.trim()) ? row.expectedGrade.trim() : 'A',
          progressPercent: row.progressPercent || 0,
          linkedSkills,
        },
        chapters: new Map(),
      });
    }
    const chapterTitle = row.chapterTitle?.trim();
    if (!chapterTitle) continue;
    const entry = courses.get(name);
    if (!entry.chapters.has(chapterTitle)) {
      entry.chapters.set(chapterTitle, { coefficient: row.chapterCoefficient || 1, items: [] });
    }
    const itemTitle = row.itemTitle?.trim();
    if (itemTitle) entry.chapters.get(chapterTitle).items.push({ title: itemTitle, coefficient: row.itemCoefficient || 1 });
  }
  return [...courses.values()].map(({ data, chapters }) => ({
    ...data,
    chapters: [...chapters.entries()]
      .map(([title, ch]) => ({ title, coefficient: ch.coefficient, checklistItems: ch.items }))
      .filter((ch) => ch.checklistItems.length > 0),
  }));
}

export default function CourseCsvTools({ courses }) {
  const { addCourse } = useLearningStore();
  const skills = useSkillStore((s) => s.skills);
  const fileRef = useRef(null);
  const [result, setResult] = useState(null); // { imported, errors: [{course, message}] }

  const exportCsv = () => {
    if (!courses.length) return toast('No courses to export.', 'info');
    const csv = toCSV(courses.flatMap(courseRows), COLUMNS);
    downloadCSV(`audax-courses-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(`Exported ${courses.length} course${courses.length > 1 ? 's' : ''}`, 'success');
  };

  const importCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Skills only have ids/level/xp — names live in SKILL_MAP (utils/constants).
    const skillsById = new Set(Object.keys(skills));
    const skillsByName = new Map(Object.entries(SKILL_MAP).map(([id, s]) => [s.name.toLowerCase(), id]));

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result));
      const parsed = rowsToCourses(rows, skillsById, skillsByName);
      let imported = 0;
      const errors = [];
      parsed.forEach(({ chapters, ...data }) => {
        const res = validate(courseSchema, data);
        if (!res.ok) {
          errors.push({ course: data.name || '(unnamed)', message: res.error });
          return;
        }
        addCourse({ ...res.data, chapters });
        imported++;
      });
      setResult({ imported, errors });
      toast(`Imported ${imported} course${imported === 1 ? '' : 's'}${errors.length ? `, ${errors.length} skipped` : ''}`, errors.length ? 'warning' : 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={exportCsv}>
          <span className="flex items-center gap-2"><Download size={13} /> Export CSV</span>
        </Button>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
          <span className="flex items-center gap-2"><Upload size={13} /> Import CSV</span>
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
      </div>
      {result?.errors.length > 0 && (
        <div className="text-[11px] text-mute max-h-24 overflow-y-auto border border-line rounded-lg p-2 space-y-0.5">
          {result.errors.slice(0, 20).map((e, i) => (
            <div key={i} className="text-bad">{e.course}: {e.message}</div>
          ))}
          {result.errors.length > 20 && <div>…and {result.errors.length - 20} more.</div>}
        </div>
      )}
    </div>
  );
}
