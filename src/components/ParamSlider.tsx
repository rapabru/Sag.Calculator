import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

interface Props {
  label: string;
  /** Símbolo corto que aparece junto a la etiqueta, p. ej. "L" o "T₀". */
  symbol?: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  /** Texto chico bajo el control (pista o valor derivado). */
  hint?: string;
  /** Botón opcional al lado de la etiqueta, p. ej. «centrar». */
  action?: React.ReactNode;
  onChange: (value: number) => void;
  /**
   * Se dispara al SOLTAR el control (fin de arrastre, Enter o salir del campo),
   * no en cada píxel del arrastre. Sirve para lanzar la animación de la caída
   * sin que se reinicie sesenta veces por segundo mientras movés el slider.
   */
  onCommit?: () => void;
}

/** Acepta coma o punto como separador decimal: el teclado del celular da coma. */
function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Sólo dígitos, un separador decimal y un signo al principio. */
const TYPING_RE = /^-?\d*[.,]?\d*$/;

const format = (v: number, decimals: number) =>
  Number.isFinite(v) ? String(Number(v.toFixed(decimals))) : '';

/**
 * Slider y campo numérico acoplados. El slider es para explorar y ver cómo se
 * mueve el gráfico; el campo es para escribir el valor exacto que uno midió.
 *
 * El campo mantiene su propio texto en vez de derivarlo del número. Esa es la
 * diferencia importante: un input controlado que descarta lo que no parsea hace
 * imposible dejar el campo vacío, porque al borrar el último carácter React
 * vuelve a pintar el valor viejo. Acá los estados intermedios ("", "-", "1,")
 * son válidos mientras escribís, y el número sólo viaja al padre cuando el
 * texto parsea.
 */
export const ParamSlider: React.FC<Props> = ({
  label,
  symbol,
  unit,
  value,
  min,
  max,
  step,
  decimals = 1,
  hint,
  action,
  onChange,
  onCommit,
}) => {
  const id = useId();
  const [text, setText] = useState(() => format(value, decimals));
  const focused = useRef(false);

  // El texto se resincroniza desde el valor sólo cuando el campo NO tiene foco,
  // para que mover el slider lo actualice pero escribir no se pise a sí mismo.
  useEffect(() => {
    if (!focused.current) setText(format(value, decimals));
  }, [value, decimals]);

  const handleText = useCallback(
    (raw: string) => {
      if (!TYPING_RE.test(raw)) return;
      setText(raw);
      const n = parseNumber(raw);
      if (n !== null) onChange(n);
    },
    [onChange],
  );

  const commit = useCallback(() => {
    focused.current = false;
    const n = parseNumber(text);
    if (n === null) {
      // Quedó vacío o a medio escribir: se restaura el último valor válido.
      setText(format(value, decimals));
    } else {
      const clamped = Math.min(Math.max(n, min), max);
      setText(format(clamped, decimals));
      if (clamped !== n) onChange(clamped);
    }
    onCommit?.();
  }, [text, value, decimals, min, max, onChange, onCommit]);

  const fill = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;

  return (
    <div className="field">
      <div className="field-top">
        <label className="field-label" htmlFor={id}>
          {label}
          {symbol && <span className="sym">{symbol}</span>}
        </label>
        <div className="field-value">
          {action}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onFocus={(e) => {
              focused.current = true;
              e.currentTarget.select();
            }}
            onChange={(e) => handleText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <span className="field-unit">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        value={Math.min(Math.max(value, min), max)}
        min={min}
        max={max}
        step={step}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
};
