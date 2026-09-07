import { G, WAIST_RATIO } from './constants';
import { prepareRig, type SolvedRig } from './staticSolver';
import { solveEnergyFall } from './energyFall';
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
 *      `leashLength` es el largo ÚTIL, del anillo al arnés y con los nudos ya
 *      hechos. La cuerda entera es bastante más larga (3–4 m en highline), pero
 *      lo que gobierna la caída es la distancia que efectivamente queda.
 *
 *   3. Frenado. Para una fuerza F que el leash aplica sobre la cinta, la
 *      profundidad de la persona es
 *        z(F) = S(F) + leashLength + F·leashLength/EA_leash
 *      donde S(F) sale del mismo solver estático — la cinta se hunde mucho más
 *      que en estático porque F es varias veces el peso corporal.
 *
 *   4. Conservación de energía entre el arranque y el punto más bajo (ver
 *      energyFall.ts, compartido con el modelo de caída a la backup):
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
 * El leash se toma como INEXTENSIBLE. Una cuerda dinámica de verdad estira —a
 * 1,5 m y 2,9 kN son unos 22 cm— pero toda la absorción relevante la hace la
 * cinta: se hunde varios metros contra esos centímetros, o sea el 97 % del
 * recorrido de frenado. Ignorar el estiramiento del leash sube la fuerza pico
 * alrededor de un 3 %, así que el resultado queda del lado conservador.
 *
 * Contraste externo: Chocoslack mide 250–750 kgf (2,5–7,4 kN) en un leash de
 * 2 m, y este modelo cae dentro de ese rango.
 */

export function solveFall(input: RigInput, rig: SolvedRig = prepareRig(input)): FallResult {
  const m = Math.max(input.personMassKg, 0.1);
  const W = m * G;
  const leashLength = Math.max(input.leashLength, 0);

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

  // El leash se toma como inextensible: toda la absorción la hace la cinta.
  const depthFor = (F: number) => rig.sagAtLoadFor(F) + leashLength;

  const { peakForceN, personLowestDepth, trajectory } = solveEnergyFall({ m, z0, freeFall, depthFor });

  const peakLineState = rig.stateFor(peakForceN);
  const dynamicSag = peakLineState.sagAtLoad;
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
    dynamicStrain: peakLineState.strain,
    overElongated: peakLineState.strain * 100 > input.elongationLimitPct,
    peakLineState,
    trajectory,
  };
}
