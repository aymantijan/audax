import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useSkillStore } from '../../store/skillStore';
import { toCSV, parseCSV, downloadCSV } from '../../utils/csv';
import { courseSchema, validate } from '../../utils/validators';
import { GRADES, SKILL_MAP } from '../../utils/constants';
import { Button } from '../common/ui';
import { toast } from '../../store/uiStore';

// Flat CSV shape (one row per course) — export writes every column, import
// reads them back by header name (order-independent, extra columns ignored).
// linkedSkills is a single column of skill ids/names joined with ";".
const COLUMNS = [
  { key: 'name', label: 'name', get: (c) => c.name },
  { key: 'institution', label: 'institution', get: (c) => c.institution },
  { key: 'professor', label: 'professor', get: (c) => c.professor },
  { key: 'credits', label: 'credits', get: (c) => c.credits },
  { key: 'expectedGrade', label: 'expectedGrade', get: (c) => c.expectedGrade },
  { key: 'progressPercent', label: 'progressPercent', get: (c) => c.progressPercent ?? 0 },
  { key: 'linkedSkills', label: 'linkedSkills', get: (c) => (c.linkedSkills || []).join(';') },
];

function rowToCourseData(row, skillsById, skillsByName) {
  const linkedSkills = (row.linkedSkills || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (skillsById.has(s) ? s : skillsByName.get(s.toLowerCase())))
    .filter(Boolean);
  return {
    name: row.name?.trim(),
    institution: row.institution?.trim() || '',
    professor: row.professor?.trim() || '',
    credits: row.credits,
    expectedGrade: GRADES.includes(row.expectedGrade?.trim()) ? row.expectedGrade.trim() : 'A',
    progressPercent: row.progressPercent || 0,
    linkedSkills,
  };
}

export default function CourseCsvTools({ courses }) {
  const { addCourse } = useLearningStore();
  const skills = useSkillStore((s) => s.skills);
  const fileRef = useRef(null);
  const [result, setResult] = useState(null); // { imported, errors: [{row, message}] }

  const exportCsv = () => {
    if (!courses.length) return toast('No courses to export.', 'info');
    const csv = toCSV(courses, COLUMNS);
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
      let imported = 0;
      const errors = [];
      rows.forEach((row, i) => {
        const data = rowToCourseData(row, skillsById, skillsByName);
        const res = validate(courseSchema, data);
        if (!res.ok) {
          errors.push({ row: i + 2, message: res.error });
          return;
        }
        addCourse(res.data);
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
            <div key={i} className="text-bad">Row {e.row}: {e.message}</div>
          ))}
          {result.errors.length > 20 && <div>…and {result.errors.length - 20} more.</div>}
        </div>
      )}
    </div>
  );
}
