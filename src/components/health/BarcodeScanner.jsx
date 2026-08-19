import { useEffect, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { lookupBarcode } from '../../services/openfoodfacts';
import { Modal, Button, Input, Field } from '../common/ui';

// Native BarcodeDetector (Chrome/Android) — absent on Safari/iOS, in which
// case we fall back to manual digit entry below rather than pulling in a
// heavy JS decoding library for a secondary path.
const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export default function BarcodeScanner({ open, onClose, onProduct }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState(''); // '', 'scanning', 'looking-up', 'not-found', 'error'

  useEffect(() => {
    if (!open || !hasNativeDetector) return;
    let cancelled = false;
    let detector;
    try {
      detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    } catch {
      setStatus('error');
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus('scanning');

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              handleCode(codes[0].rawValue);
              return; // stop polling once we hand off to lookup
            }
          } catch {
            // transient decode failures are normal mid-stream — keep polling
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setStatus('error'));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleCode = async (code) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setStatus('looking-up');
    try {
      const product = await lookupBarcode(code);
      if (!product) { setStatus('not-found'); return; }
      onProduct(product);
    } catch {
      setStatus('error');
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Scanner un code-barres">
      <div className="space-y-4">
        {hasNativeDetector ? (
          <div className="rounded-lg overflow-hidden bg-black/80 aspect-video relative">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {status === 'looking-up' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">Recherche du produit…</div>
            )}
          </div>
        ) : (
          <p className="text-xs text-mute">Scan caméra indisponible sur ce navigateur (Safari/iOS notamment) — saisis le numéro manuellement.</p>
        )}

        {status === 'not-found' && <p className="text-xs text-bad">Produit introuvable dans OpenFoodFacts. Essaie la saisie manuelle ou logue-le par nom.</p>}
        {status === 'error' && <p className="text-xs text-bad">Caméra ou recherche indisponible — utilise la saisie manuelle.</p>}

        <form onSubmit={submitManual} className="flex items-end gap-2">
          <Field label="Ou saisis le code-barres">
            <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="ex. 3017620422003" />
          </Field>
          <Button type="submit" variant="secondary"><span className="flex items-center gap-2"><ScanBarcode size={14} /> Chercher</span></Button>
        </form>
      </div>
    </Modal>
  );
}
