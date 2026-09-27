import { useMemo } from 'react';
import { TrendingUp, UserCheck, Clock, Brain, ListChecks, Info } from 'lucide-react';
import { useLearningStore } from '../../store/learningStore';
import { useFocusStore } from '../../store/focusStore';
import { useFlashcardStore } from '../../store/flashcardStore';
import { buildForecastContext, forecastSubject, forecastPotential, isTassType } from '../../utils/prediction';
import { fmtGrade, evalTypeLabel, subjectPass } from '../../utils/academic';
import { fmtMinutes } from '../../utils/study';
import { todayKey } from '../../utils/formatters';
import { Card } from '../common/ui';
import { SectionHeader, useAcademicSettings, gradeColor, tint } from './design';

/** Forecast context for the active semester (memoised on the raw store slices). */
export function useForecastContext() {
  const courses = useLearningStore((s) => s.courses);
  const academic = useLearningStore((s) => s.academic);
  const attendance = useLearningStore((s) => s.attendance);
  const sessions = useFocusStore((s) => s.sessions);
  const decks = useFlashcardStore((s) => s.decks);
  const cards = useFlashcardStore((s) => s.cards);
  const reviewLog = useFlashcardStore((s) => s.reviewLog);
  const settings = useAcademicSettings();
  const today = todayKey();
  return useMemo(
    () => buildForecastContext({ courses, academic, attendance, sessions, decks, cards, reviewLog, settings, today }),
    [courses, academic, attendance, sessions, decks, cards, reviewLog, today] // eslint-disable-line react-hooks/exhaustive-deps
  );
}

const pct = (v) => `${Math.round(v * 100)} %`;
const CONF_COLOR = { faible: 'var(--text-secondary)', moyenne: 'var(--warning)', bonne: 'var(--success)' };

/** "≈ 12,4" next to a subject's current average in lists. */
export function ForecastBadge({ forecast, settings }) {
  if (!forecast || forecast.average == null) return null;
  return (
    <span className="text-[11px] tabular-nums whitespace-nowrap" title={`Moyenne prévue (confiance ${forecast.confidence})`} style={{ color: gradeColor(forecast.average, settings) }}>
      ≈ {fmtGrade(forecast.average, 1)}
    </span>
  );
}

function Driver({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon size={13} className="text-accent shrink-0 mt-0.5" />
      <span className="flex-1 text-mute">{label}{hint && <span className="block text-[10px] opacity-80">{hint}</span>}</span>
      <span className="text-ink font-medium tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}

export function ForecastCard({ course }) {
  const ctx = useForecastContext();
  const settings = ctx.settings;
  const f = useMemo(() => forecastSubject(course, ctx), [course, ctx]);
  const potential = useMemo(() => forecastPotential(course, ctx), [course, ctx]);
  const { sig } = f;
  const pending = f.evals.filter((x) => !x.graded);
  const pass = subjectPass(settings);

  if (!pending.length) return null;
  const noData = f.evals.every((x) => x.graded || x.estimate == null);

  return (
    <Card>
      <SectionHeader icon={TrendingUp} title="Prévision"
        subtitle={noData ? undefined : <>Confiance <b style={{ color: CONF_COLOR[f.confidence] }}>{f.confidence}</b> · s’affine avec tes notes, ton assiduité et ton travail</>} />
      {noData ? (
        <p className="text-sm text-mute">
          Pas encore assez de données. La prévision apparaît après les premiers cours pointés, les premières sessions d’étude sur cette matière ou une première note.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] text-mute">Moyenne prévue</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: gradeColor(f.average ?? f.partialAverage, settings) }}>
                {f.average != null ? `≈ ${fmtGrade(f.average, 1)}` : '—'}<span className="text-sm text-mute font-normal">/{settings.scale}</span>
              </div>
              {f.average != null && (
                <div className="text-[11px] mt-0.5" style={{ color: f.average >= pass ? 'var(--success)' : 'var(--error)' }}>
                  {f.average >= pass ? `matière validée (≥ ${fmtGrade(pass)})` : `sous la validation (${fmtGrade(pass)})`}
                </div>
              )}
            </div>
            {potential != null && f.average != null && potential - f.average >= 0.25 && (
              <div className="text-right rounded-lg px-3 py-2" style={{ background: tint('var(--success)', 10) }}>
                <div className="text-[10px] text-mute">Assiduité parfaite + temps d’étude tenu</div>
                <div className="text-sm font-semibold tabular-nums text-good">≈ {fmtGrade(potential, 1)} (+{fmtGrade(potential - f.average, 1)})</div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {f.evals.map((x) => (
              <div key={x.ev.id} className="flex items-center gap-2 text-sm rounded-lg bg-surface px-3 py-1.5">
                <span className="flex-1 min-w-0 truncate text-ink">{x.ev.name || evalTypeLabel(x.ev.type)} <span className="text-mute text-xs">{x.ev.weight} %</span></span>
                {isTassType(x.ev.type) && sig.A != null && <span className="text-[10px] text-mute whitespace-nowrap">assiduité {pct(sig.A)}</span>}
                {x.graded ? (
                  <span className="text-xs text-mute">note connue</span>
                ) : x.estimate != null ? (
                  <span className="tabular-nums font-semibold" style={{ color: gradeColor(x.estimate, settings) }}>≈ {fmtGrade(x.estimate, 2)}</span>
                ) : (
                  <span className="text-xs text-mute">pas de signal</span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-3 border-t border-line">
            {sig.info.A && <Driver icon={UserCheck} label="Assiduité" hint={`${sig.info.A.classes} cours · ${sig.info.A.absences} absence(s) — pèse surtout sur le TASS`} value={pct(sig.A)} />}
            {sig.info.S && <Driver icon={Clock} label="Temps d’étude depuis la rentrée" hint="part de l’objectif hebdo selon le coefficient" value={`${fmtMinutes(sig.info.S.studied)} / ${fmtMinutes(sig.info.S.expected)}`} />}
            {sig.info.F && <Driver icon={Brain} label="Fiches : rappel (30 j)" hint={`${sig.info.F.reviews} révisions`} value={pct(sig.info.F.recall)} />}
            {sig.info.P && <Driver icon={ListChecks} label="Programme" hint={`semestre écoulé à ${pct(sig.info.P.frac)}`} value={pct(sig.info.P.done)} />}
            {!sig.info.S && !sig.info.F && !sig.info.P && (
              <p className="text-[11px] text-mute">Pour estimer CC et CF : lance le minuteur d’étude sur cette matière, crée ses fiches ou son programme.</p>
            )}
          </div>

          <p className="text-[10px] text-mute flex items-start gap-1.5">
            <Info size={11} className="shrink-0 mt-px" />
            Estimation, pas une promesse : notes déjà obtenues, puis assiduité (TASS) et travail fourni (CC, CF), corrigés au fil de tes vraies notes.
          </p>
        </div>
      )}
    </Card>
  );
}
