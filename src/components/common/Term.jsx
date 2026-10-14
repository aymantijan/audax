import { useState } from 'react';
import { GLOSSARY, termText, useUiLevel } from '../../utils/ui-level';

// A technical term (S11). Simple mode: an everyday word. Expert mode: the term
// itself, dotted-underlined; a tap shows what it means.
export default function Term({ id, short = false }) {
  const level = useUiLevel();
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[id];
  const text = termText(id, level, { short });
  if (!g || level === 'simple') return <>{text}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        title={g.def}
        className="underline decoration-dotted underline-offset-2 cursor-help"
      >
        {text}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-line bg-card p-2.5 text-xs font-normal normal-case tracking-normal text-ink shadow-xl">
          <b>{g.simple}</b> — {g.def}
        </span>
      )}
    </span>
  );
}
