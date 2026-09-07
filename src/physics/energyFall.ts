import { G } from './constants';

/**
 * BÚSQUEDA DE FUERZA PICO POR BALANCE DE ENERGÍA
 * ================================================
 * Compartido entre el modelo de caída con leash (fallSolver.ts) y el de
 * caída a la cinta de backup (backupFallSolver.ts): la única diferencia
 * entre esos dos escenarios es QUÉ cinta se estira bajo la fuerza F
 * (`depthFor`) y desde dónde arranca la caída libre (`z0`, `freeFall`) — el
 * barrido de energía y la trayectoria para animar son idénticos.
 *
 * Para una fuerza de frenado F, la profundidad del punto de amarre es
 * `depthFor(F)` (ya incluye cualquier término fijo, como el largo de un
 * leash inextensible). La energía disponible al caer una distancia adicional
 * `freeFall + depthFor(F) − depthFor(0)` se guarda contra la energía elástica
 * absorbida `U(F) = ∫₀^F F' dz`; el cruce da la fuerza pico.
 *
 * U(F) crece más rápido que la energía disponible a medida que F sube (la
 * cinta se pone cada vez más vertical bajo la carga puntual, así que dz/dF no
 * se apaga: U es ~cuadrática en F contra un término del lado derecho que es
 * ~lineal), así que el cruce existe siempre para cualquier entrada física
 * real — el barrido de edge-cases de scripts/verify.ts nunca llega a
 * necesitar el último intento. Si el reintento se agota es que algo quedó
 * degenerado (EA≈0, entradas muy fuera de cualquier rango razonable): se
 * devuelve igual el mejor valor visto, pero avisado en vez de silencioso.
 */

const GRID = 400;
const FRAMES = 72;

export interface EnergyFallParams {
  /** Masa de la persona (kg). */
  m: number;
  /** Profundidad de partida antes de la caída libre (m). */
  z0: number;
  /** Distancia de caída libre antes de que la cinta que frena tome carga (m). */
  freeFall: number;
  /** Profundidad del punto de amarre para una fuerza de frenado F dada (m). */
  depthFor: (F: number) => number;
}

export interface EnergyFallSolution {
  peakForceN: number;
  /** Profundidad del punto de amarre en el pico (m). */
  personLowestDepth: number;
  /** Trayectoria para animar: profundidad en función del avance 0..1. */
  trajectory: number[];
}

export function solveEnergyFall(p: EnergyFallParams): EnergyFallSolution {
  const { m, z0, freeFall, depthFor } = p;
  const zAtRest = depthFor(0);

  // Barrido en F: profundidad, energía absorbida y balance energético.
  let fMax = Math.max(30 * m * G, 20_000);
  let Fs: number[] = [];
  let zs: number[] = [];
  let Us: number[] = [];
  let crossing = -1;

  for (let attempt = 0; attempt < 8 && crossing < 0; attempt++) {
    Fs = [];
    zs = [];
    Us = [];
    let U = 0;
    for (let i = 0; i <= GRID; i++) {
      const F = (i / GRID) * fMax;
      const z = depthFor(F);
      if (i > 0) U += 0.5 * (F + Fs[i - 1]) * (z - zs[i - 1]);
      Fs.push(F);
      zs.push(z);
      Us.push(U);
      if (crossing < 0 && i > 0 && U - m * G * (freeFall + z - zAtRest) >= 0) crossing = i;
    }
    if (crossing < 0) fMax *= 4;
  }

  if (crossing < 0) {
    console.warn('solveEnergyFall: no se encontró equilibrio de energía en el rango de fuerza buscado; el resultado puede no ser válido.');
  }

  // Interpolación lineal del cruce entre la energía absorbida y la disponible.
  let peakForceN = Fs[Fs.length - 1];
  if (crossing > 0) {
    const balance = (i: number) => Us[i] - m * G * (freeFall + zs[i] - zAtRest);
    const b0 = balance(crossing - 1);
    const b1 = balance(crossing);
    const frac = b1 !== b0 ? -b0 / (b1 - b0) : 0;
    peakForceN = Fs[crossing - 1] + frac * (Fs[crossing] - Fs[crossing - 1]);
  }

  const personLowestDepth = z0 + freeFall + (depthFor(peakForceN) - zAtRest);

  return {
    peakForceN,
    personLowestDepth,
    trajectory: buildTrajectory({ m, z0, freeFall, zAtRest, peakForceN, personLowestDepth, Fs, zs, Us }),
  };
}

interface TrajectoryArgs {
  m: number;
  z0: number;
  freeFall: number;
  zAtRest: number;
  peakForceN: number;
  personLowestDepth: number;
  Fs: number[];
  zs: number[];
  Us: number[];
}

/**
 * Trayectoria real en el tiempo, para animar la caída: caída libre parabólica y
 * después frenado, con v(F)² = 2·(energía disponible − energía absorbida)/m.
 */
function buildTrajectory(a: TrajectoryArgs): number[] {
  const engageDepth = a.z0 + a.freeFall;
  const tFree = Math.sqrt((2 * a.freeFall) / G);

  // Tiempo acumulado durante el frenado, integrando dt = dz / v.
  const brakeT: number[] = [0];
  const brakeZ: number[] = [engageDepth];
  for (let i = 1; i < a.Fs.length && a.Fs[i] <= a.peakForceN; i++) {
    const avail = a.m * G * (a.freeFall + a.zs[i] - a.zAtRest);
    const v2 = (2 * (avail - a.Us[i])) / a.m;
    const vPrev2 = (2 * (a.m * G * (a.freeFall + a.zs[i - 1] - a.zAtRest) - a.Us[i - 1])) / a.m;
    const v = Math.sqrt(Math.max(v2, 0));
    const vPrev = Math.sqrt(Math.max(vPrev2, 0));
    const vAvg = (v + vPrev) / 2;
    const dz = a.zs[i] - a.zs[i - 1];
    if (vAvg > 1e-6 && dz > 0) {
      brakeT.push(brakeT[brakeT.length - 1] + dz / vAvg);
      brakeZ.push(a.z0 + a.freeFall + (a.zs[i] - a.zAtRest));
    }
  }
  const tBrake = brakeT[brakeT.length - 1] ?? 0;
  const total = tFree + tBrake;

  const out: number[] = [];
  for (let f = 0; f <= FRAMES; f++) {
    const t = (f / FRAMES) * total;
    if (t <= tFree) {
      out.push(a.z0 + 0.5 * G * t * t);
    } else {
      const tb = t - tFree;
      let k = 1;
      while (k < brakeT.length && brakeT[k] < tb) k++;
      if (k >= brakeT.length) out.push(a.personLowestDepth);
      else {
        const span = brakeT[k] - brakeT[k - 1];
        const frac = span > 0 ? (tb - brakeT[k - 1]) / span : 0;
        out.push(brakeZ[k - 1] + frac * (brakeZ[k] - brakeZ[k - 1]));
      }
    }
  }
  out[out.length - 1] = a.personLowestDepth;
  return out;
}
