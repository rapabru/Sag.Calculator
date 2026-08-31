import { G, WAIST_RATIO } from './constants';
import { prepareRig, type SolvedRig } from './staticSolver';
import type { FallResult, RigInput } from './types';

/**
 * MODELO DE CAÍDA CON LEASH
 * =========================
 * La persona está de pie en la cinta, amarrada por el leash al anillo que corre
 * sobre la propia cinta. Se cae. El leash toma carga y el sistema
 * cinta + leash (dos resortes en serie) frena la caída.
 *
 * Secuencia:
 *
 *   1. De pie, el arnés está a `harnessHeight` POR ENCIMA de la cinta, y el
 *      anillo del leash está sobre la cinta, a la profundidad S₁. El leash
 *      está flojo.
 *        z₀ = S₁ − harnessHeight
 *      La altura del arnés no se pide: sale de la estatura, porque la cintura
 *      está a ~0,58 de la altura de una persona.
 *
 *   2. Caída libre. La persona cae hasta que el leash se estira. Recorre su
 *      propia altura sobre la cinta más el largo del leash:
 *        h_ff = leashLength + harnessHeight
 *
 *   3. Frenado. Para una fuerza F que el leash aplica sobre la cinta, la
 *      profundidad de la persona es
 *        z(F) = S(F) + leashLength + F·leashLength/EA_leash
 *      donde S(F) sale del mismo solver estático — la cinta se hunde mucho más
 *      que en estático porque F es varias veces el peso corporal.
 *
 *   4. Conservación de energía entre el arranque y el punto más bajo:
 *        m·g·(h_ff + z(F*) − z(0)) = U(F*),   U(F) = ∫₀^F F′ dz
 *      Raíz única: el lado izquierdo crece ~linealmente con F y U ~cuadrática.
 *
 *   5. Profundidad final del ARNÉS bajo la línea de anclajes:
 *        z_max = S₁ + leashLength + (z(F*) − z(0))
 *      Y lo que toca el suelo no es el arnés sino los pies, que cuelgan otros
 *      0,58 × estatura por debajo:
 *        punto_más_bajo_del_cuerpo = z_max + 0,58 · estatura
 *
 * SUPUESTOS (deliberadamente conservadores, es una cuenta de seguridad):
 * modelo cuasi-estático de energía. Ignora amortiguación, histéresis de la
 * cinta, deslizamiento del anillo, absorción del cuerpo y elasticidad de los
 * anclajes; y toma el rebote de la cinta como si no ayudara a frenar. Las
 * fuerzas pico reales suelen quedar 10–30 % por debajo.
 *
 * El leash se modela como resorte lineal. La cuerda real no lo es: es blanda a
 * carga baja y se endurece al cargarla. Por eso su rigidez se calibra en el
 * rango donde ocurre la caída (`leashRefForceN`, típicamente 6 kN) y no en el
 * punto de ensayo de la norma, que usa 80 kg. La recta resultante queda más
 * rígida que la cuerda real a carga baja, o sea del lado conservador.
 *
 * Contraste externo: Chocoslack mide 250–750 kgf (2,5–7,4 kN) en un leash de
 * 2 m, y este modelo cae dentro de ese rango.
 */

const GRID = 400;

export function solveFall(input: RigInput, rig: SolvedRig = prepareRig(input)): FallResult {
  const m = Math.max(input.personMassKg, 0.1);
  const W = m * G;
  const leashLength = Math.max(input.leashLength, 0);
  const leashEA = Math.max(input.leashRefForceN, 1) / (Math.max(input.leashElongationPct, 0.05) / 100);

  // La cintura marca las dos distancias del cuerpo, y son la misma: lo que el
  // arnés sobresale de la cinta estando parado, y lo que el cuerpo cuelga por
  // debajo del arnés estando colgado.
  const harnessHeight = WAIST_RATIO * Math.max(input.personHeight, 0.5);
  const feetBelowHarness = harnessHeight;

  const standing = rig.stateFor(W);
  const S1 = standing.sagAtLoad;
  const z0 = S1 - harnessHeight;

  /** Caída libre hasta que el leash toma carga. */
  const freeFall = leashLength + harnessHeight;

  const leashStretch = (F: number) => (F * leashLength) / leashEA;
  const depthFor = (F: number) => rig.sagAtLoadFor(F) + leashLength + leashStretch(F);

  const zAtRest = depthFor(0);

  // Barrido en F: profundidad, energía absorbida y balance energético.
  let fMax = Math.max(30 * W, 20_000);
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

  // Interpolación lineal del cruce entre la energía absorbida y la disponible.
  let peakForceN = Fs[Fs.length - 1];
  if (crossing > 0) {
    const balance = (i: number) => Us[i] - m * G * (freeFall + zs[i] - zAtRest);
    const b0 = balance(crossing - 1);
    const b1 = balance(crossing);
    const frac = b1 !== b0 ? -b0 / (b1 - b0) : 0;
    peakForceN = Fs[crossing - 1] + frac * (Fs[crossing] - Fs[crossing - 1]);
  }

  const peakLineState = rig.stateFor(peakForceN);
  const dynamicSag = peakLineState.sagAtLoad;
  const extension = leashStretch(peakForceN);
  const descentAfterEngage = dynamicSag + leashLength + extension - zAtRest;
  const personLowestDepth = S1 + leashLength + descentAfterEngage;
  const lowestBodyPoint = personLowestDepth + feetBelowHarness;

  return {
    peakForceN,
    peakForceBodyWeights: peakForceN / W,
    peakLineTensionN: peakLineState.H,
    peakAnchorTensionN: peakLineState.anchorTensionN,
    dynamicSag,
    extraSag: dynamicSag - S1,
    personLowestDepth,
    fallGroundClearance: input.anchorHeight - personLowestDepth,
    harnessHeight,
    feetBelowHarness,
    lowestBodyPoint,
    bodyGroundClearance: input.anchorHeight - lowestBodyPoint,
    // Lo que llega al suelo son los pies, no el punto del arnés.
    hitsGround: lowestBodyPoint >= input.anchorHeight,
    totalDrop: personLowestDepth - z0,
    freeFallDistance: freeFall,
    fallFactor: leashLength > 0 ? freeFall / leashLength : 0,
    leashExtension: extension,
    dynamicStrain: peakLineState.strain,
    overElongated: peakLineState.strain * 100 > input.elongationLimitPct,
    peakLineState,
    trajectory: buildTrajectory({
      m,
      z0,
      freeFall,
      zAtRest,
      peakForceN,
      personLowestDepth,
      Fs,
      zs,
      Us,
    }),
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

const FRAMES = 72;

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
