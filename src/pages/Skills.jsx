import { useState } from 'react';
import { useSkillStore } from '../store/skillStore';
import { SKILL_TREE, SKILL_MAP, XP_TO_NEXT, LEVEL_NAMES } from '../utils/constants';
import { fmtDate } from '../utils/formatters';
import { Stat, Button, Modal, ProgressBar, Badge, EmptyState } from '../components/common/ui';
import SkillTreeMap from '../components/skills/SkillTreeMap';

export default function Skills() {
  const { skills, awardXP, acquireManually } = useSkillStore();
  const [selected, setSelected] = useState(null);

  const list = Object.values(skills);
  const totalLevels = list.reduce((a, s) => a + s.level, 0);
  const unlocked = list.filter((s) => !s.locked).length;
  const mastered = list.filter((s) => s.level === 5).length;
  const totalXP = list.flatMap((s) => s.xpLog).filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);

  const def = selected ? SKILL_MAP[selected] : null;
  const skill = selected ? skills[selected] : null;
  const children = selected ? SKILL_TREE.filter((d) => d.prereqs.includes(selected)) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Skill Tree Map</h1>
        <p className="text-mute text-sm mt-1">
          211 skills across Trading, Finance, Knowledge, Soft Skills, and Discipline. Every trade, course, and habit feeds the tree — unlock prerequisites to advance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total levels" value={totalLevels} sub={`across ${list.length} skills`} />
        <Stat label="Unlocked" value={`${unlocked}/${list.length}`} />
        <Stat label="Mastered (Lv5)" value={mastered} />
        <Stat label="Lifetime XP" value={totalXP} />
      </div>

      <SkillTreeMap onSelect={setSelected} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={def?.name || ''}>
        {def && skill && (
          <div className="space-y-4">
            <p className="text-sm text-mute">{def.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="var(--accent-primary)">Lv{skill.level} — {LEVEL_NAMES[skill.level]}</Badge>
              <Badge color="var(--accent-secondary)">{def.category} · {def.track}</Badge>
              {skill.manualAcquired && <Badge color="var(--success)">acquired manually</Badge>}
              {skill.decayStatus !== 'active' && <Badge color="var(--warning)">{skill.decayStatus}</Badge>}
              {skill.locked && <Badge color="var(--error)">locked</Badge>}
            </div>

            {!skill.locked && skill.level < 5 && (
              <div>
                <div className="flex justify-between text-xs text-mute mb-1">
                  <span>Progress to Lv{skill.level + 1}</span>
                  <span>{skill.xp}/{XP_TO_NEXT[skill.level]} XP</span>
                </div>
                <ProgressBar value={skill.xp} max={XP_TO_NEXT[skill.level]} />
              </div>
            )}

            <div className="text-xs text-mute">
              Last practiced: <span className="text-ink">{skill.lastPracticed ? fmtDate(skill.lastPracticed) : 'never'}</span>
            </div>

            {def.prereqs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Prerequisites</div>
                <ul className="text-sm space-y-1">
                  {def.prereqs.map((p) => (
                    <li key={p} className={skills[p]?.level >= 2 ? 'text-good' : 'text-mute'}>
                      {skills[p]?.level >= 2 ? '✓' : '○'} {SKILL_MAP[p]?.name} (Lv{skills[p]?.level ?? 0}, needs Lv2+)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {children.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">Unlocks</div>
                <div className="flex flex-wrap gap-1.5">
                  {children.map((c) => (
                    <Badge key={c.id} color="var(--accent-secondary)">{c.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-mute uppercase tracking-wide mb-1.5">XP history</div>
              {skill.xpLog.length ? (
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {[...skill.xpLog].reverse().slice(0, 20).map((e, i) => (
                    <li key={i} className="flex justify-between text-mute">
                      <span>{e.source}</span>
                      <span className={e.amount >= 0 ? 'text-good' : 'text-bad'}>
                        {e.amount >= 0 ? '+' : ''}{e.amount} XP · {fmtDate(e.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>No XP yet. Log trades, complete courses, or check habits linked to this skill.</EmptyState>
              )}
            </div>

            {!skill.locked && (
              <Button variant="secondary" className="w-full" onClick={() => awardXP(def.id, 5, 'manual')}>
                Award +5 XP manually
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
