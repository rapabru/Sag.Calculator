import React from 'react';

/**
 * La cintura está a 0,58 de la estatura, medida desde los pies. Es el mismo
 * número que usa la física para decidir cuánto sobresale el arnés sobre la
 * cinta y cuánto cuelga el cuerpo por debajo del arnés.
 */
export const WAIST_FRACTION = 0.58;

interface Props {
  /** Punto de apoyo en px: los pies si está parada, el arnés si cuelga. */
  x: number;
  y: number;
  /** Altura de la figura en px, ya con la exageración vertical aplicada. */
  height: number;
  /** Referencia horizontal en px, SIN exagerar. */
  girth: number;
  pose: 'standing' | 'hanging';
  color: string;
  faded?: boolean;
}

/**
 * La figura se dibuja a escala real: con la exageración vertical en ×1 mide
 * exactamente la estatura de la persona en el mismo px/metro que el resto del
 * gráfico, así la altura libre a los pies se ve además de leerse.
 *
 * Vertical y horizontal se pasan por separado a propósito. Cuando se exagera el
 * eje vertical, la figura se estira igual que todo lo demás pero no se ensancha:
 * queda alta y flaca, que es justamente la señal de que el eje está estirado.
 */
export const PersonFigure: React.FC<Props> = ({ x, y, height: h, girth: w, pose, color, faded }) => {
  const common = {
    stroke: color,
    fill: 'none',
    strokeWidth: Math.max(w * 0.028, 1.1),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const headR = Math.max(w * 0.085, 1.6);

  if (pose === 'standing') {
    // Origen en los pies, sobre la cinta. Brazos arriba: es lo que hace
    // cualquiera parado sobre una slackline.
    return (
      <g transform={`translate(${x} ${y})`} opacity={faded ? 0.3 : 1} aria-hidden="true">
        <circle cx={0} cy={-0.905 * h} r={headR} fill={color} stroke="none" />
        <path {...common} d={`M0 ${-0.82 * h}V${-WAIST_FRACTION * h}`} />
        <path {...common} d={`M0 ${-WAIST_FRACTION * h}l${-0.075 * w} ${0.30 * h}L${-0.055 * w} 0`} />
        <path {...common} d={`M0 ${-WAIST_FRACTION * h}l${0.075 * w} ${0.30 * h}L${0.055 * w} 0`} />
        <path {...common} d={`M0 ${-0.80 * h}L${-0.20 * w} ${-0.88 * h}L${-0.30 * w} ${-1.01 * h}`} />
        <path {...common} d={`M0 ${-0.80 * h}L${0.20 * w} ${-0.88 * h}L${0.30 * w} ${-1.01 * h}`} />
      </g>
    );
  }

  // Colgada: el origen es el ARNÉS, o sea la cintura. Por encima queda el torso
  // (0,42·h) y por debajo las piernas (0,58·h), que son las que llegan al suelo.
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.3 : 1} aria-hidden="true">
      <circle cx={0} cy={-0.345 * h} r={headR} fill={color} stroke="none" />
      <path {...common} d={`M0 ${-0.26 * h}V0`} />
      <path {...common} d={`M0 ${-0.24 * h}L${-0.16 * w} ${-0.10 * h}L${-0.20 * w} ${0.05 * h}`} />
      <path {...common} d={`M0 ${-0.24 * h}L${0.16 * w} ${-0.10 * h}L${0.20 * w} ${0.05 * h}`} />
      <path {...common} d={`M0 0l${-0.07 * w} ${0.30 * h}L${-0.075 * w} ${WAIST_FRACTION * h}`} />
      <path {...common} d={`M0 0l${0.07 * w} ${0.30 * h}L${0.075 * w} ${WAIST_FRACTION * h}`} />
    </g>
  );
};
