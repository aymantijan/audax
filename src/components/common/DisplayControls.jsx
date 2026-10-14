import { useState } from 'react';
import { Sun, Moon, Contrast } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { TEXT_SIZES, resolveDisplay, saveLocalDisplay, applyDisplay } from '../../utils/display';

const chip = (active) => `ui-btn flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer ${active ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-line text-mute hover:text-ink'}`;

// Text size, theme and contrast in one place (A4, G4). Shown on the very first
// screen and in Paramètres → Affichage. Applies at once; saved on the profile
// when there is one, and on this device either way.
export default function DisplayControls({ compact = false }) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [d, setD] = useState(() => resolveDisplay(user));

  const set = (patch) => {
    const next = { ...d, ...patch };
    setD(next);
    saveLocalDisplay(patch);
    if (user) updateProfile(patch);
    applyDisplay(next);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <div>
        {!compact && <div className="text-sm font-medium mb-1.5">Taille du texte</div>}
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Taille du texte">
          {TEXT_SIZES.map((t, i) => (
            <button key={t.value} type="button" aria-pressed={d.textSize === t.value} onClick={() => set({ textSize: t.value })} className={chip(d.textSize === t.value)}>
              <span style={{ fontSize: `${1 + i * 0.2}em` }} aria-hidden="true">Aa</span>
              {!compact && <span className="text-xs">{t.label}</span>}
              {compact && <span className="sr-only">{t.label}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={d.theme === 'light'} onClick={() => set({ theme: d.theme === 'light' ? 'dark' : 'light' })} className={chip(false)}>
          {d.theme === 'light' ? <Moon size={15} /> : <Sun size={15} />} {d.theme === 'light' ? 'Thème sombre' : 'Thème clair'}
        </button>
        <button type="button" aria-pressed={d.contrast === 'high'} onClick={() => set({ contrast: d.contrast === 'high' ? 'normal' : 'high' })} className={chip(d.contrast === 'high')}>
          <Contrast size={15} /> Contraste fort
        </button>
      </div>
    </div>
  );
}
