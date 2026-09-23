import { useSearchParams, Link } from 'react-router-dom';
import { Sun, GraduationCap, CalendarDays, CalendarClock, Library, BookOpen, Brain } from 'lucide-react';
import { useFlashcardStore, buildQueue } from '../store/flashcardStore';
import { useLearningStore } from '../store/learningStore';
import { Button } from '../components/common/ui';
import { SegmentedTabs, useAcademicSettings } from '../components/learning/design';
import TodayView from '../components/learning/TodayView';
import CursusView from '../components/learning/CursusView';
import TimetableView from '../components/learning/TimetableView';
import ExamsView from '../components/learning/ExamsView';
import CoursesView from '../components/learning/CoursesView';
import ReviewView from '../components/learning/ReviewView';
import { upcomingEvaluations, normGrade } from '../utils/academic';
import { todayKey } from '../utils/formatters';

const TABS = [
  { key: 'today', label: 'Aujourd’hui', icon: Sun, Component: TodayView },
  { key: 'cursus', label: 'Cursus', icon: GraduationCap, Component: CursusView },
  { key: 'timetable', label: 'Emploi du temps', icon: CalendarDays, Component: TimetableView },
  { key: 'exams', label: 'Évaluations', icon: CalendarClock, Component: ExamsView },
  { key: 'review', label: 'Révisions', icon: Brain, Component: ReviewView },
  { key: 'courses', label: 'Tous les cours', icon: Library, Component: CoursesView },
];

export default function Learning() {
  const [params, setParams] = useSearchParams();
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0];
  const Active = tab.Component;

  const today = todayKey();
  const upcomingCount = upcomingEvaluations(courses, today).filter((x) => !x.past && normGrade(x.ev, settings) == null).length;
  const activeCount = courses.filter((c) => c.status === 'active').length;
  const fc = useFlashcardStore();
  const reviewCount = buildQueue({ cards: fc.cards, decks: fc.decks, reviewLog: fc.reviewLog, settings: fc.settings }).length;
  const tabs = TABS.map((t) => ({
    ...t,
    count: t.key === 'exams' ? upcomingCount || null : t.key === 'courses' ? activeCount || null : t.key === 'review' ? reviewCount || null : null,
  }));

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Apprentissage</h1>
          <p className="text-mute text-sm mt-1">Études, formations et lectures : notes, échéances et progression au même endroit.</p>
        </div>
        <Link to="/learning/readings" className="hidden sm:block">
          <Button variant="secondary"><span className="flex items-center gap-1.5"><BookOpen size={14} /> Lectures</span></Button>
        </Link>
      </div>
      <SegmentedTabs tabs={tabs} value={tab.key} onChange={(k) => setParams(k === 'today' ? {} : { tab: k }, { replace: true })} />
      <Active />
    </div>
  );
}
