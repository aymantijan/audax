import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Clock } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { WEEKDAYS, isAcademic } from '../../utils/academic';
import { Card } from '../common/ui';
import { SectionHeader, tint, useAcademicSettings } from './design';

// Stable colour per subject so it reads the same across the grid and lists.
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16', '#3b82f6', '#f97316'];
export const courseColor = (id = '') => PALETTE[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];

const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

export default function TimetableView() {
  const courses = useLearningStore((s) => s.courses);
  const settings = useAcademicSettings();
  const todayDow = new Date().getDay();

  const slots = useMemo(() => {
    const out = [];
    for (const c of courses) {
      if (c.status !== 'active') continue;
      if (isAcademic(c) && settings.activeTermId && c.termId && c.termId !== settings.activeTermId) continue;
      for (const sl of c.slots || []) out.push({ ...sl, course: c });
    }
    return out.sort((a, b) => toMin(a.start) - toMin(b.start));
  }, [courses, settings.activeTermId]);

  const days = WEEKDAYS.filter((d) => d.value !== 0 || slots.some((s) => Number(s.day) === 0));
  const weeklyMinutes = slots.reduce((s, sl) => s + Math.max(0, toMin(sl.end) - toMin(sl.start)), 0);

  if (!slots.length) {
    return (
      <Card>
        <div className="text-center py-8">
          <CalendarDays size={26} className="mx-auto text-mute mb-2" />
          <p className="text-sm font-medium text-ink">Emploi du temps vide</p>
          <p className="text-xs text-mute mt-1 max-w-md mx-auto">
            Ouvrez une matière et ajoutez ses créneaux (jour, heure, salle, cours/TD/TP). Ils apparaîtront ici, semaine type du semestre actif.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={CalendarDays} title="Semaine type"
        subtitle={`${slots.length} créneau(x) · ${Math.floor(weeklyMinutes / 60)} h${weeklyMinutes % 60 ? String(weeklyMinutes % 60).padStart(2, '0') : ''} de cours par semaine`} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {days.map((d) => {
          const daySlots = slots.filter((s) => Number(s.day) === d.value);
          const isToday = d.value === todayDow;
          return (
            <div key={d.value} className={`rounded-xl border bg-card p-3 min-h-[120px] ${isToday ? 'border-accent' : 'border-line'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-ink'}`}>{d.label}</span>
                {isToday && <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-accent/15 text-accent font-semibold">Aujourd'hui</span>}
              </div>
              {daySlots.length ? (
                <div className="space-y-2">
                  {daySlots.map((s) => {
                    const color = courseColor(s.course.id);
                    return (
                      <Link key={s.id} to={`/learning/course/${s.course.id}`}
                        className="block rounded-lg px-2.5 py-2 border-l-[3px] hover:brightness-110 transition"
                        style={{ background: tint(color, 12), borderColor: color }}>
                        <div className="text-[11px] tabular-nums flex items-center gap-1" style={{ color }}><Clock size={10} /> {s.start}–{s.end} · {s.kind}</div>
                        <div className="text-xs font-medium text-ink mt-0.5 leading-snug">{s.course.name}</div>
                        {s.room && <div className="text-[10px] text-mute mt-0.5 flex items-center gap-1"><MapPin size={9} /> {s.room}</div>}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-mute">Libre</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
