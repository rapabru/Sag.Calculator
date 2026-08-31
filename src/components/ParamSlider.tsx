import React, { useId } from 'react';

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
  onChange: (value: number) => void;
}

/**
 * Slider y campo numérico acoplados. El slider es para explorar y ver cómo se
 * mueve el gráfico; el campo es para escribir el valor exacto que uno midió.
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
  onChange,
}) => {
  const id = useId();
  const fill = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;

  return (
    <div className="field">
      <div className="field-top">
        <label className="field-label" htmlFor={id}>
          {label}
          {symbol && <span className="sym">{symbol}</span>}
        </label>
        <div className="field-value">
          <input
            id={id}
            type="number"
            value={Number.isFinite(value) ? Number(value.toFixed(decimals)) : ''}
            min={min}
            step={step}
            onChange={(e) => {
              const next = parseFloat(e.target.value);
              if (Number.isFinite(next)) onChange(next);
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
      />
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 1 }}>{hint}</div>}
    </div>
  );
};
