import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, Check, GraduationCap, ClipboardCheck, Wallet, Dumbbell, Target, Stethoscope } from 'lucide-react';
import { useHabitStore } from '../store/habitStore';
import { useLearningStore } from '../store/learningStore';
import { useAccountingStore } from '../store/accountingStore';
import { useHealthStore } from '../store/healthStore';
import { buildWeek, mondayOf, addDaysKey } from '../utils/week-view';
import { periodOf } from '../utils/objectives';
import { todayKey, fmtMAD } from '../utils/formatters';
import { Card, EmptyState } from '../components/common/ui';

const dayTitle = (key) => { const s = new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

// « Ma semaine » (chantier 5, J3): the whole week in one place, day by day.
// Habits tick from here; everything else opens its own page.
export default function Week() {
  const today = todayKey();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const objectives = useHabitStore((s) => s.objectives);
  const toggleHabit = useHabitStore((s) => s.toggleHabit);
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const echeances = useAccountingStore((s) => s.echeances);
  const workouts = useHealthStore((s) => s.workouts);
  const appointments = useHealthStore((s) => s.appointments);

  const days = useMemo(() => buildWeek({ monday, courses, academic, habits, logs, echeances, workouts, appointments }), [monday, courses, academic, habits, logs, echeances, workouts, appointments]);
  const weekGoals = (objectives || []).filter((o) => o.horizon === 'week' && o.period === periodOf('week', monday));
  const sunday = addDaysKey(monday, 6);
  const range = `${new Date(`${monday}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${new Date(`${sunday}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  const thisWeek = monday === mondayOf(today);
  const navBtn = 'ui-icon-btn flex items-center justify-center rounded-lg p-2 text-mute hover:text-ink hover:bg-card cursor-pointer';

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarRange size={22} /> Ma semaine</h1>
        <p className="text-mute text-sm mt-1">Cours, habitudes, évaluations, échéances et sport, jour par jour.</p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card px-2 py-1.5">
        <button type="button" className={navBtn} aria-label="Semaine précédente" onClick={() => setMonday(addDaysKey(monday, -7))}><ChevronLeft size={18} /></button>
        <div className="text-center">
          <div className="text-sm font-semibold">{range}</div>
          {!thisWeek && <button type="button" className="text-xs text-accent hover:underline cursor-pointer" onClick={() => setMonday(mondayOf(today))}>Revenir à cette semaine</button>}
        </div>
        <button type="button" className={navBtn} aria-label="Semaine suivante" onClick={() => setMonday(addDaysKey(monday, 7))}><ChevronRight size={18} /></button>
      </div>

      {weekGoals.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Target size={15} /> Objectifs de la semaine</span>}>
          <ul className="space-y-1.5 text-sm">
            {weekGoals.map((o) => <li key={o.id} className={`flex items-center gap-2 ${o.done ? 'text-mute line-through' : ''}`}><Check size={14} className={o.done ? 'text-good' : 'text-line'} /> {o.title}</li>)}
          </ul>
        </Card>
      )}

      {days.map((d) => {
        const empty = !d.classes.length && !d.habits.length && !d.exams.length && !d.dues.length && !d.workouts.length && !d.appointments.length;
        const isToday = d.key === today;
        const future = d.key > today;
        return (
          <section key={d.key} className={`rounded-xl border bg-card p-4 ${isToday ? 'border-accent' : 'border-line'}`} aria-label={dayTitle(d.key)}>
            <h2 className={`font-semibold mb-2 ${isToday ? 'text-accent' : ''}`}>{isToday ? `Aujourd’hui · ${dayTitle(d.key)}` : dayTitle(d.key)}</h2>
            {empty ? <p className="text-sm text-mute">Rien de prévu.</p> : (
              <div className="space-y-2.5">
                {d.classes.length > 0 && (
                  <ul className="space-y-1">
                    {d.classes.map((c) => (
                      <li key={c.key} className="flex items-center gap-2 text-sm">
                        <GraduationCap size={14} className="text-accent shrink-0" />
                        <span className="font-data text-xs text-mute w-24 shrink-0">{c.start}–{c.end}</span>
                        <Link to={`/learning/course/${c.course.id}`} className="truncate hover:underline">{c.course.name}</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {d.appointments.map((a) => (
                  <Link key={a.id} to="/health?tab=appointments" className="flex items-center gap-2 text-sm hover:underline"><Stethoscope size={14} className="text-bad shrink-0" /> <span className="font-data text-xs text-mute w-24 shrink-0">{a.time || ''}</span><span className="truncate">{a.title}{a.place ? ` · ${a.place}` : ''}</span></Link>
                ))}
                {d.exams.map(({ course, ev }) => (
                  <div key={ev.id} className="flex items-center gap-2 text-sm"><ClipboardCheck size={14} className="text-warning shrink-0" /> <span className="truncate">{ev.name || 'Évaluation'} · {course.name}</span></div>
                ))}
                {d.dues.map((x) => (
                  <div key={x.id} className="flex items-center gap-2 text-sm"><Wallet size={14} className="text-accent shrink-0" /> <span className="flex-1 truncate">{x.label}</span><span className="font-data text-xs">{fmtMAD(x.amount)}</span></div>
                ))}
                {d.workouts.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm"><Dumbbell size={14} className="text-good shrink-0" /> <span className="truncate">{w.exercise || w.sessionType || 'Séance'}{w.durationMin ? ` · ${w.durationMin} min` : ''}</span></div>
                ))}
                {d.habits.length > 0 && (
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {d.habits.map(({ habit, done }) => (
                      <li key={habit.id}>
                        <button type="button" disabled={future || !!habit.source} onClick={() => toggleHabit(habit.id, d.key)} aria-pressed={done}
                          aria-label={`${habit.name} : ${done ? 'fait' : 'pas fait'}`}
                          className={`ui-btn flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer disabled:cursor-default ${done ? 'border-good bg-good/15 text-ink' : 'border-line text-mute hover:border-accent'} ${future ? 'opacity-70' : ''}`}>
                          {done && <Check size={12} className="text-good" />} {habit.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
      {days.every((d) => !d.classes.length && !d.habits.length) && <EmptyState>Ajoute des habitudes ou un emploi du temps pour remplir ta semaine.</EmptyState>}
    </div>
  );
}
