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
  /** Tamaño de la figura en px. Nunca lleva la exageración vertical aplicada. */
  size: number;
  pose: 'standing' | 'hanging';
  color: string;
  faded?: boolean;
}

/**
 * Se dibuja a escala real: con la exageración vertical en ×1 mide exactamente la
 * estatura de la persona en el mismo px/metro que el resto del gráfico.
 *
 * La exageración vertical NO se le aplica: una persona estirada al doble de su
 * altura queda grotesca y no aporta nada. Se mantiene proporcionada y quien
 * exagera el eje ve el aviso en el cartel de escala.
 */
export const PersonFigure: React.FC<Props> = ({ x, y, size: h, pose, color, faded }) => {
  const common = {
    stroke: color,
    fill: 'none',
    strokeWidth: Math.max(h * 0.028, 1.1),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const headR = Math.max(h * 0.085, 1.6);

  if (pose === 'standing') {
    // Origen en los pies, sobre la cinta. Brazos arriba: es lo que hace
    // cualquiera parado sobre una slackline.
    return (
      <g transform={`translate(${x} ${y})`} opacity={faded ? 0.3 : 1} aria-hidden="true">
        <circle cx={0} cy={-0.905 * h} r={headR} fill={color} stroke="none" />
        <path {...common} d={`M0 ${-0.82 * h}V${-WAIST_FRACTION * h}`} />
        <path {...common} d={`M0 ${-WAIST_FRACTION * h}l${-0.075 * h} ${0.30 * h}L${-0.055 * h} 0`} />
        <path {...common} d={`M0 ${-WAIST_FRACTION * h}l${0.075 * h} ${0.30 * h}L${0.055 * h} 0`} />
        <path {...common} d={`M0 ${-0.80 * h}L${-0.20 * h} ${-0.88 * h}L${-0.30 * h} ${-1.01 * h}`} />
        <path {...common} d={`M0 ${-0.80 * h}L${0.20 * h} ${-0.88 * h}L${0.30 * h} ${-1.01 * h}`} />
      </g>
    );
  }

  // Colgada: el origen es el ARNÉS, o sea la cintura. Por encima queda el torso
  // (0,42·h) y por debajo las piernas (0,58·h), que son las que llegan al suelo.
  return (
    <g transform={`translate(${x} ${y})`} opacity={faded ? 0.3 : 1} aria-hidden="true">
      <circle cx={0} cy={-0.345 * h} r={headR} fill={color} stroke="none" />
      <path {...common} d={`M0 ${-0.26 * h}V0`} />
      <path {...common} d={`M0 ${-0.24 * h}L${-0.16 * h} ${-0.10 * h}L${-0.20 * h} ${0.05 * h}`} />
      <path {...common} d={`M0 ${-0.24 * h}L${0.16 * h} ${-0.10 * h}L${0.20 * h} ${0.05 * h}`} />
      <path {...common} d={`M0 0l${-0.07 * h} ${0.30 * h}L${-0.075 * h} ${WAIST_FRACTION * h}`} />
      <path {...common} d={`M0 0l${0.07 * h} ${0.30 * h}L${0.075 * h} ${WAIST_FRACTION * h}`} />
    </g>
  );
};
