import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Recorrido guiado que se muestra la primera vez y se puede volver a abrir.
 *
 * El foco se hace con un div del tamaño del elemento y una sombra enorme
 * alrededor (`box-shadow: 0 0 0 9999px`). Es más simple y más fiable que
 * recortar una máscara, y no toca el layout de la página.
 */

const SEEN_KEY = 'sagcalc.guideSeen';

interface Step {
  /** Elemento a señalar, por `data-tour`. Sin él, la tarjeta va centrada. */
  target?: string;
  titleKey: string;
  bodyKey: string;
}

const STEPS: Step[] = [
  { titleKey: 'guide.s1.title', bodyKey: 'guide.s1.body' },
  { target: 'chart', titleKey: 'guide.s2.title', bodyKey: 'guide.s2.body' },
  { target: 'presets', titleKey: 'guide.s3.title', bodyKey: 'guide.s3.body' },
  { target: 'fall', titleKey: 'guide.s4.title', bodyKey: 'guide.s4.body' },
  { target: 'export', titleKey: 'guide.s5.title', bodyKey: 'guide.s5.body' },
];

export function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // sin almacenamiento, no insistimos en cada carga
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* la guía volverá a aparecer, no es grave */
  }
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const GuideTour: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const current = STEPS[step];

  const measure = useCallback(() => {
    if (!current.target) return setBox(null);
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    const pad = 6;
    setBox({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }, [current.target]);

  useLayoutEffect(() => {
    measure();
    const el = current.target ? document.querySelector(`[data-tour="${current.target}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const after = window.setTimeout(measure, 380);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(after);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, current.target]);

  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const last = step === STEPS.length - 1;

  // La tarjeta va debajo del foco, salvo que no entre y entonces va arriba.
  const cardStyle: React.CSSProperties = box
    ? box.top + box.height + 190 < window.innerHeight
      ? { top: box.top + box.height + 12, left: Math.max(12, Math.min(box.left, window.innerWidth - 340)) }
      : { top: Math.max(12, box.top - 186), left: Math.max(12, Math.min(box.left, window.innerWidth - 340)) }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="guide-root" role="dialog" aria-modal="true" aria-label={t('guide.title')}>
      {/* Tocar fuera de la tarjeta cierra la guía. */}
      <div className={`guide-catcher${box ? '' : ' guide-catcher--dim'}`} onClick={close} />
      {box && (
        <div
          className="guide-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div className="guide-card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="guide-step">
          {step + 1} / {STEPS.length}
        </div>
        <h3>{t(current.titleKey)}</h3>
        <p>{t(current.bodyKey)}</p>
        <div className="guide-actions">
          <button className="btn" onClick={close}>
            {t('guide.skip')}
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button className="btn" onClick={() => setStep((s) => s - 1)}>
              {t('guide.prev')}
            </button>
          )}
          <button className="btn primary" onClick={() => (last ? close() : setStep((s) => s + 1))}>
            {last ? t('guide.done') : t('guide.next')}
          </button>
        </div>
      </div>
    </div>
  );
};
