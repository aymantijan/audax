import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import { useLearningStore } from '../store/learningStore';
import { calculateCourseProgress } from '../utils/course-progress';
import { GRADES, SKILL_MAP } from '../utils/constants';
import { uid, fmtDate } from '../utils/formatters';
import { Card, Stat, Button, Badge, ProgressBar, EmptyState } from '../components/common/ui';
import EntityFormModal from '../components/common/EntityFormModal';
import SkillPicker from '../components/common/SkillPicker';

// Detail page: /learning/course/:id — chapter + checklist CRUD.
// Every mutation flows through learningStore.updateCourse → all pages using
// the course (Learning list, Dashboard) re-render immediately.
export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { courses, updateCourse, deleteCourse, toggleChecklistItem, getCourseScore } = useLearningStore();
  const course = courses.find((c) => c.id === courseId);
  const [openChapters, setOpenChapters] = useState({});
  const [chapterModal, setChapterModal] = useState(null); // null | { data, isAdd }
  const [itemModal, setItemModal] = useState(null); // null | { chapterId, data, isAdd }
  const [courseNameModal, setCourseNameModal] = useState(false);

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <GraduationCap className="mx-auto mb-3 text-mute" size={30} />
        <h1 className="text-xl font-semibold">Course not found</h1>
        <p className="text-mute text-sm mt-1">It may have been deleted.</p>
        <Link to="/learning" className="inline-block mt-4 text-accent text-sm hover:underline">← Back to Learning</Link>
      </div>
    );
  }

  const chapters = course.chapters || [];
  const progress = calculateCourseProgress(course);

  // ─── Chapter operations ───
  const saveChapter = (data) => {
    const coefficient = Math.max(0.5, Math.min(2, Number(data.coefficient) || 1));
    if (chapterModal?.isAdd) {
      updateCourse(courseId, {
        chapters: [...chapters, { id: uid(), title: data.title || 'Untitled', coefficient, checklistItems: [] }],
      });
    } else {
      updateCourse(courseId, {
        chapters: chapters.map((ch) => (ch.id === chapterModal.data.id ? { ...ch, title: data.title, coefficient } : ch)),
      });
    }
  };
  const deleteChapter = (chapterId) => {
    if (!confirm('Delete this chapter and all its items?')) return;
    updateCourse(courseId, { chapters: chapters.filter((ch) => ch.id !== chapterId) });
  };

  // ─── Item operations ───
  const saveItem = (data) => {
    const coefficient = Math.max(0.5, Math.min(2, Number(data.coefficient) || 1));
    const chapterId = itemModal.chapterId;
    updateCourse(courseId, {
      chapters: chapters.map((ch) => {
        if (ch.id !== chapterId) return ch;
        if (itemModal.isAdd) {
          return { ...ch, checklistItems: [...(ch.checklistItems || []), { id: uid(), title: data.title || '(untitled)', coefficient, completed: false, completedDate: null }] };
        }
        return {
          ...ch,
          checklistItems: ch.checklistItems.map((it) => (it.id === itemModal.data.id ? { ...it, title: data.title, coefficient } : it)),
        };
      }),
    });
  };
  const deleteItem = (chapterId, itemId) => {
    updateCourse(courseId, {
      chapters: chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, checklistItems: ch.checklistItems.filter((it) => it.id !== itemId) } : ch
      ),
    });
  };
  // Delegates to the store action (not a local reimplementation) so completing
  // a task here also feeds the learning-momentum system — see learningStore.
  const toggleItem = (chapterId, itemId) => toggleChecklistItem(courseId, chapterId, itemId);

  const handleDeleteCourse = () => {
    if (!confirm(`Delete course "${course.name}"? This cannot be undone.`)) return;
    deleteCourse(courseId);
    navigate('/learning');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/learning" className="inline-flex items-center gap-1 text-mute hover:text-ink text-sm cursor-pointer mb-2">
            <ArrowLeft size={14} /> Learning
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{course.name}</h1>
            <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setCourseNameModal(true)} title="Edit course info">
              <Pencil size={14} />
            </button>
          </div>
          <p className="text-mute text-sm mt-1">
            {course.institution}{course.professor ? ` · ${course.professor}` : ''} · {course.credits} credits
            {course.updatedAt && <> · <span title={fmtDate(course.updatedAt)}>edited {fmtDate(course.updatedAt)}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setChapterModal({ data: {}, isAdd: true })}>
            <span className="flex items-center gap-2"><Plus size={14} /> Chapter</span>
          </Button>
          <Button variant="danger" onClick={handleDeleteCourse}>Delete course</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Progress" value={`${progress}%`} sub={`${chapters.length} chapters`} />
        <Stat label="Score" value={`${getCourseScore(course)}%`} sub="progress × learning momentum" color="var(--accent-primary)" />
        <Stat label="Target grade" value={course.expectedGrade || '—'} />
        <Stat label="Actual grade" value={course.actualGrade || '—'} />
        <Stat label="Status" value={course.status || 'active'} />
      </div>

      <ProgressBar value={progress} color={progress >= 100 ? 'var(--success)' : 'var(--accent-primary)'} height={10} />

      {course.linkedSkills?.length > 0 && (
        <Card title="Linked skills (XP on completion)">
          <div className="flex flex-wrap gap-1.5">
            {course.linkedSkills.map((id) => (
              <Badge key={id} color="var(--accent-secondary)">{SKILL_MAP[id]?.name || id}</Badge>
            ))}
          </div>
        </Card>
      )}

      {chapters.length === 0 ? (
        <Card>
          <EmptyState>
            No chapters yet. Add one to break the course into weighted sections.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {chapters.map((ch) => {
            const open = openChapters[ch.id] ?? true;
            const items = ch.checklistItems || [];
            const done = items.filter((it) => it.completed).length;
            const chW = items.reduce((s, it) => s + (Number(it.coefficient) || 1), 0);
            const doneW = items.reduce((s, it) => s + (it.completed ? Number(it.coefficient) || 1 : 0), 0);
            const chProg = chW ? Math.round((doneW / chW) * 100) : 0;
            return (
              <div key={ch.id} className="border border-line rounded-xl bg-card">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button onClick={() => setOpenChapters((o) => ({ ...o, [ch.id]: !open }))} className="text-mute cursor-pointer">
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <span className="text-sm font-semibold flex-1">{ch.title}</span>
                  <span className="text-xs text-mute">×{ch.coefficient}</span>
                  <span className="text-xs text-mute">· {done}/{items.length} done</span>
                  <span className="text-sm font-medium w-12 text-right">{chProg}%</span>
                  <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setChapterModal({ data: ch, isAdd: false })} title="Edit chapter">
                    <Pencil size={13} />
                  </button>
                  <button className="text-mute hover:text-bad cursor-pointer" onClick={() => deleteChapter(ch.id)} title="Delete chapter">
                    <Trash2 size={13} />
                  </button>
                </div>
                {open && (
                  <div className="border-t border-line/50 px-4 py-2">
                    <ul className="divide-y divide-line/40">
                      {items.map((it) => (
                        <li key={it.id} className="py-2 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={it.completed} onChange={() => toggleItem(ch.id, it.id)} className="cursor-pointer" />
                          <span className={it.completed ? 'line-through text-mute flex-1' : 'flex-1'}>{it.title}</span>
                          <span className="text-[10px] text-mute">×{it.coefficient}</span>
                          <button className="text-mute hover:text-accent cursor-pointer" onClick={() => setItemModal({ chapterId: ch.id, data: it, isAdd: false })} title="Edit item">
                            <Pencil size={12} />
                          </button>
                          <button className="text-mute hover:text-bad cursor-pointer" onClick={() => { if (confirm('Delete this item?')) deleteItem(ch.id, it.id); }} title="Delete item">
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setItemModal({ chapterId: ch.id, data: {}, isAdd: true })}
                      className="mt-2 text-xs text-accent cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={11} /> Add item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chapter add/edit */}
      {chapterModal && (
        <EntityFormModal
          open={!!chapterModal}
          onClose={() => setChapterModal(null)}
          title={chapterModal.isAdd ? 'Add chapter' : 'Edit chapter'}
          fields={[
            { name: 'title', label: 'Chapter title', type: 'text' },
            { name: 'coefficient', label: 'Coefficient', type: 'number', step: '0.1', min: 0.5, max: 2, hint: '0.5–2.0 (weight vs. other chapters)' },
          ]}
          initial={chapterModal.isAdd ? { coefficient: 1 } : chapterModal.data}
          onSave={saveChapter}
          onDelete={chapterModal.isAdd ? null : () => deleteChapter(chapterModal.data.id)}
        />
      )}

      {/* Checklist item add/edit */}
      {itemModal && (
        <EntityFormModal
          open={!!itemModal}
          onClose={() => setItemModal(null)}
          title={itemModal.isAdd ? 'Add item' : 'Edit item'}
          fields={[
            { name: 'title', label: 'Item title', type: 'text' },
            { name: 'coefficient', label: 'Coefficient', type: 'number', step: '0.1', min: 0.5, max: 2, hint: '0.5–2.0 (weight within this chapter)' },
          ]}
          initial={itemModal.isAdd ? { coefficient: 1 } : itemModal.data}
          onSave={saveItem}
          onDelete={itemModal.isAdd ? null : () => deleteItem(itemModal.chapterId, itemModal.data.id)}
        />
      )}

      {/* Course-level info edit */}
      {courseNameModal && (
        <EntityFormModal
          open={courseNameModal}
          onClose={() => setCourseNameModal(false)}
          title="Edit course"
          fields={[
            { name: 'name', label: 'Course name', type: 'text' },
            { name: 'institution', label: 'Institution', type: 'text' },
            { name: 'professor', label: 'Professor', type: 'text' },
            { name: 'credits', label: 'Credits', type: 'number', min: 1 },
            { name: 'expectedGrade', label: 'Expected grade', type: 'select', options: GRADES },
          ]}
          initial={course}
          wide
          onSave={(values) => updateCourse(courseId, values)}
        />
      )}
    </div>
  );
}
