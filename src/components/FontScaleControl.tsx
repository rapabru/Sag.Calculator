import React, { useEffect, useState } from 'react';

const KEY = 'sagcalc.fontScale';
const STEPS = [1, 1.1, 1.2, 1.35, 1.5];

function initial(): number {
  try {
    const stored = Number(localStorage.getItem(KEY));
    if (STEPS.includes(stored)) return stored;
  } catch {
    /* sin almacenamiento: arranca en el tamaño por defecto */
  }
  return STEPS[0];
}

/** Agrandador de tipografía: escala todo el texto de la interfaz vía --font-scale. */
export const FontScaleControl: React.FC<{ decLabel: string; incLabel: string }> = ({
  decLabel,
  incLabel,
}) => {
  const [scale, setScale] = useState<number>(initial);
  const idx = STEPS.indexOf(scale);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(scale));
    try {
      localStorage.setItem(KEY, String(scale));
    } catch {
      /* preferencia sólo para esta sesión */
    }
  }, [scale]);

  return (
    <div className="font-scale-group no-print">
      <button
        type="button"
        title={decLabel}
        aria-label={decLabel}
        disabled={idx <= 0}
        onClick={() => setScale(STEPS[Math.max(0, idx - 1)])}
      >
        <span className="step-a">A</span>
      </button>
      <span className="step-pct">{Math.round(scale * 100)}%</span>
      <button
        type="button"
        title={incLabel}
        aria-label={incLabel}
        disabled={idx >= STEPS.length - 1}
        onClick={() => setScale(STEPS[Math.min(STEPS.length - 1, idx + 1)])}
      >
        <span className="step-a is-big">A</span>
      </button>
    </div>
  );
};
