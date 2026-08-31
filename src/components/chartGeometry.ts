/**
 * Geometría del gráfico, separada del componente para poder verificarla.
 *
 * La propiedad que importa: `scale` es UN solo número en px/metro y se usa
 * tanto para el eje horizontal como para el vertical. Mientras la exageración
 * vale 1, un metro horizontal y un metro vertical miden exactamente lo mismo en
 * pantalla — que es lo que hace que el dibujo represente la forma real de la
 * línea en vez de una decoración.
 */

export const VB_W = 1000;
export const PAD_L = 54;
export const PAD_R = 20;
export const PAD_T = 26;
export const PAD_B = 44;
export const INNER_W = VB_W - PAD_L - PAD_R;
export const MAX_INNER_H = 545;
export const MIN_INNER_H = 190;

export interface GeometryParams {
  span: number;
  /** Profundidad del sag estático más profundo (m). */
  staticDepth: number;
  /** Profundidad de la caída a encuadrar (m); 0 si la caída está oculta. */
  fallDepth: number;
  /** Altura de los anclajes = profundidad del suelo (m). */
  groundDepth: number;
  exaggeration: number;
}

export interface ChartGeometry {
  /** px por metro. El mismo valor para los dos ejes. */
  scale: number;
  /** metro -> px, eje horizontal. */
  px: (m: number) => number;
  /** profundidad en metros -> px, eje vertical (aplica la exageración). */
  py: (depth: number) => number;
  /** px -> metro, para el arrastre de la persona. */
  mFromPx: (p: number) => number;
  showGround: boolean;
  groundDepth: number;
  /** Profundidad del borde inferior del encuadre (m). */
  bottom: number;
  vbH: number;
  innerH: number;
}

export function computeChartGeometry(p: GeometryParams): ChartGeometry {
  const span = Math.max(p.span, 0.01);
  const exaggeration = Math.max(p.exaggeration, 1e-6);

  const xPad = span * 0.045;
  const xMin = -xPad;
  const xRange = span + 2 * xPad;

  const deepest = Math.max(p.staticDepth, p.fallDepth, 0.05);
  // Si el suelo queda muchísimo más abajo que todo lo demás (una highline con
  // 60 m de vacío bajo 3 m de sag), encuadrarlo aplastaría la línea hasta
  // hacerla ilegible. En ese caso se marca aparte, fuera del encuadre.
  const showGround = p.groundDepth <= deepest * 1.9 + 1.5;
  const bottom = (showGround ? Math.max(p.groundDepth, deepest) : deepest) * 1.06 + deepest * 0.04;
  const headroom = Math.max(bottom * 0.08, 0.12);

  const cyTop = -headroom * exaggeration;
  const cyRange = Math.max(bottom * exaggeration - cyTop, 1e-6);

  let scale = INNER_W / xRange;
  let contentH = cyRange * scale;
  if (contentH > MAX_INNER_H) {
    scale = MAX_INNER_H / cyRange;
    contentH = MAX_INNER_H;
  }
  const innerH = Math.max(contentH, MIN_INNER_H);
  const offX = PAD_L + (INNER_W - xRange * scale) / 2;
  const offY = PAD_T + (innerH - contentH) / 2;

  return {
    scale,
    px: (m) => offX + (m - xMin) * scale,
    py: (depth) => offY + (depth * exaggeration - cyTop) * scale,
    mFromPx: (v) => xMin + (v - offX) / scale,
    showGround,
    groundDepth: p.groundDepth,
    bottom,
    vbH: PAD_T + innerH + PAD_B,
    innerH,
  };
}
