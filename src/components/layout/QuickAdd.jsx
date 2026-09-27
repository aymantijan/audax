import { useState } from 'react';
import { Plus } from 'lucide-react';
import QuickEntryModal from '../finance/QuickEntryModal';
import CaptureModal from './CaptureModal';

// Floating + button, visible on every authenticated page. It opens the
// universal capture window (one sentence or a receipt photo → a draft to
// confirm, see CaptureModal / utils/quick-capture.js), which also keeps the
// detailed shortcuts (trade, detailed expense, workout, timetable photo) that
// deep-link with `?quickadd=` to the page owning the full form.
export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <>
      <div className="fixed z-40 bottom-20 md:bottom-6 right-4 md:right-6">
        <button
          onClick={() => setOpen(true)}
          aria-label="Noter quelque chose"
          className="rounded-full flex items-center justify-center shadow-xl cursor-pointer"
          style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
        >
          <Plus size={22} className="text-on-accent" />
        </button>
      </div>
      <CaptureModal open={open} onClose={() => setOpen(false)} onQuickEntry={() => setQuickOpen(true)} />
      <QuickEntryModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}
