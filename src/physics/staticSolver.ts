import { G, WEBBING_REF_TENSION_N } from './constants';
import type { LineState, RigInput, StaticResult } from './types';

/**
 * MODELO ESTÁTICO
 * ===============
 * La cinta se modela como un cable elástico con dos cargas superpuestas:
 *
 *   1. su propio peso, distribuido (w N/m)  -> parábola
 *   2. la persona, carga puntual (P N) en x=a -> V
 *
 * Con H = componente horizontal de la tensión (constante a lo largo del vano):
 *
 *   y(x) = w·x·(L−x)/(2H)  +  P·(L−a)·x/(H·L)      para x ≤ a
 *   y(x) = w·x·(L−x)/(2H)  +  P·a·(L−x)/(H·L)      para x > a
 *
 * La diferencia clave con la versión anterior de esta app es que H NO es un dato
 * fijo: al pisar, la cinta se estira y la tensión sube. H sale de imponer
 * compatibilidad elástica entre la geometría y la ley de Hooke:
 *
 *   longitud_de_arco(H) = L₀ · (1 + H/EA)
 *
 * Esa ecuación tiene raíz única (el lado izquierdo decrece con H, el derecho
 * crece), así que se resuelve por bisección con convergencia garantizada.
 * Como efecto secundario desaparece el caso falso de "SAG infinito" que aparecía
 * cuando T < W/2: una línea real no tiene sag infinito, simplemente se estira
 * hasta encontrar una tensión de equilibrio.
 */

/** Primitiva de √(1+u²): Φ(u) = (u·√(1+u²) + asinh u) / 2 */
function phi(u: number): number {
  return (u * Math.sqrt(1 + u * u) + Math.asinh(u)) / 2;
}

/**
 * Longitud de arco de un tramo donde la pendiente u varía linealmente con x.
 * Cerrada y exacta — evita integrar numéricamente en el bucle de bisección.
 */
function arcOfSegment(uStart: number, uEnd: number, dx: number, B: number): number {
  if (dx <= 0) return 0;
  if (B <= 1e-12) return dx * Math.sqrt(1 + uStart * uStart);
  return Math.abs(phi(uStart) - phi(uEnd)) / B;
}

interface Loading {
  span: number;
  /** carga distribuida (N/m) */
  w: number;
  /** carga puntual (N) */
  P: number;
  /** posición de la carga puntual (m) */
  a: number;
}

/** Pendiente dy/dx justo a la izquierda / derecha de un punto. */
function slopeLeft(x: number, H: number, ld: Loading): number {
  return (ld.w * (ld.span - 2 * x)) / (2 * H) + (ld.P * (ld.span - ld.a)) / (H * ld.span);
}
function slopeRight(x: number, H: number, ld: Loading): number {
  return (ld.w * (ld.span - 2 * x)) / (2 * H) - (ld.P * ld.a) / (H * ld.span);
}

/** Profundidad de la cinta bajo la línea de anclajes, positiva hacia abajo. */
function depthAt(x: number, H: number, ld: Loading): number {
  const { span: L, w, P, a } = ld;
  const dist = (w * x * (L - x)) / (2 * H);
  const point = x <= a ? (P * (L - a) * x) / (H * L) : (P * a * (L - x)) / (H * L);
  return dist + point;
}

function arcLength(H: number, ld: Loading): number {
  const { span: L, w, a } = ld;
  const B = w / H;

  // Con a=0 o a=L la carga puntual cuelga directamente del anclaje: no deforma
  // el vano y sólo queda la parábola del peso propio.
  if (a <= 0 || a >= L) {
    const bare: Loading = { ...ld, P: 0, a: L / 2 };
    return arcOfSegment(slopeLeft(0, H, bare), slopeRight(L, H, bare), L, B) || L;
  }

  return (
    arcOfSegment(slopeLeft(0, H, ld), slopeLeft(a, H, ld), a, B) +
    arcOfSegment(slopeRight(a, H, ld), slopeRight(L, H, ld), L - a, B)
  );
}

/**
 * Resuelve H para una carga puntual dada, imponiendo compatibilidad elástica.
 * `unstretched` es la longitud de la cinta sin estirar (m), `EA` su rigidez (N).
 */
function solveTension(ld: Loading, unstretched: number, EA: number, pretensionN: number): number {
  if (ld.P <= 0) return pretensionN;

  const residual = (H: number) => arcLength(H, ld) - unstretched * (1 + H / EA);

  let lo = Math.max(pretensionN, 1);
  let hi = Math.max(lo * 2, ld.P);
  let guard = 0;
  while (residual(hi) > 0 && guard++ < 200) {
    lo = hi;
    hi *= 2;
    if (hi > 1e12) break;
  }
  if (residual(lo) < 0) return lo;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-7 * hi) break;
  }
  return (lo + hi) / 2;
}

const PROFILE_SAMPLES = 160;

/** Construye el estado completo de la línea para una carga puntual `P`. */
export function lineStateFor(
  ld: Loading,
  unstretched: number,
  EA: number,
  pretensionN: number,
): LineState {
  const H = solveTension(ld, unstretched, EA, pretensionN);
  const { span: L, w, P, a } = ld;

  // Muestreo del perfil. Se fuerza el punto exacto de la carga (el vértice de
  // la V) y los puntos estacionarios analíticos, para que sagMax sea exacto.
  const xs = new Set<number>([0, L, Math.min(Math.max(a, 0), L)]);
  for (let i = 0; i <= PROFILE_SAMPLES; i++) xs.add((i / PROFILE_SAMPLES) * L);
  if (w > 0) {
    const B = w / H;
    const s1 = slopeLeft(0, H, ld) / B;
    if (s1 > 0 && s1 < a) xs.add(s1);
    const s2 = L / 2 - (P * a) / (w * L);
    if (s2 > a && s2 < L) xs.add(s2);
  }

  const profile: Array<[number, number]> = [...xs]
    .sort((p, q) => p - q)
    .map((x) => [x, depthAt(x, H, ld)] as [number, number]);

  let sagMax = 0;
  let sagMaxX = 0;
  for (const [x, y] of profile) {
    if (y > sagMax) {
      sagMax = y;
      sagMaxX = x;
    }
  }

  const slope0 = Math.abs(slopeLeft(0, H, ld));
  const slopeL = Math.abs(slopeRight(L, H, ld));
  const worstSlope = Math.max(slope0, slopeL);
  const arc = arcLength(H, ld);

  return {
    H,
    anchorTensionN: H * Math.sqrt(1 + worstSlope * worstSlope),
    thetaAnchor: Math.atan(worstSlope),
    sagAtLoad: depthAt(Math.min(Math.max(a, 0), L), H, ld),
    sagMax,
    sagMaxX,
    arcLength: arc,
    strain: arc / unstretched - 1,
    profile,
  };
}

/** Todo lo que hace falta para reusar el solver desde el modelo de caída. */
export interface SolvedRig {
  loading: (P: number) => Loading;
  unstretched: number;
  EA: number;
  pretensionN: number;
  span: number;
  /** Estado completo de la línea, con perfil dibujable. */
  stateFor: (P: number) => LineState;
  /**
   * Sólo la profundidad bajo la carga, sin construir el perfil. El barrido de
   * la caída llama a esto cientos de veces por recálculo, y saltear el muestreo
   * del perfil es lo que lo hace instantáneo.
   */
  sagAtLoadFor: (P: number) => number;
}

export function prepareRig(input: RigInput): SolvedRig {
  const L = Math.max(input.span, 0.01);
  const a = Math.min(Math.max(input.personPos, 0), 1) * L;

  // Peso lineal: la principal más la fracción del backup que corre sobre el vano.
  const backupShare = input.backupLength > 0 ? input.backupLength / L : 0;
  const linearMassKgM =
    input.mainWeightGm / 1000 + (input.backupWeightGm / 1000) * backupShare;
  const w = linearMassKgM * G;

  // EA a partir del dato comercial "x % @ tensión de referencia".
  const elong = Math.max(input.webbingElongationPct, 0.05) / 100;
  const EA = WEBBING_REF_TENSION_N / elong;

  const pretensionN = Math.max(input.pretensionN, 1);
  const loading = (P: number): Loading => ({ span: L, w, P, a });

  // Longitud sin estirar, deducida del estado en reposo (cinta vacía a T0).
  const unstretched = arcLength(pretensionN, loading(0)) / (1 + pretensionN / EA);

  return {
    loading,
    unstretched,
    EA,
    pretensionN,
    span: L,
    stateFor: (P: number) => lineStateFor(loading(P), unstretched, EA, pretensionN),
    sagAtLoadFor: (P: number) => {
      const ld = loading(P);
      const H = solveTension(ld, unstretched, EA, pretensionN);
      return depthAt(a, H, ld);
    },
  };
}

export function solveStatic(input: RigInput, rig = prepareRig(input)): StaticResult {
  const empty = rig.stateFor(0);
  const loaded = rig.stateFor(input.personMassKg * G);

  return {
    empty,
    loaded,
    sagRatioPct: (loaded.sagMax / rig.span) * 100,
    groundClearance: input.anchorHeight - loaded.sagMax,
    unstretchedLength: rig.unstretched,
    webbingEA: rig.EA,
    overElongated: loaded.strain * 100 > input.elongationLimitPct,
  };
}
