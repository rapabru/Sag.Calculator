import { BACKUP_BOUNCE_LOAD_FACTOR, G, WAIST_RATIO, WEBBING_REF_TENSION_N } from './constants';
import { lineStateFor, prepareRig, restTensionForLength, sagAtLoadFast, type Loading, type SolvedRig } from './staticSolver';
import { solveEnergyFall } from './energyFall';
import type { BackupFallResult, RigInput } from './types';

/**
 * MODELO DE CAÍDA A LA CINTA DE BACKUP
 * ======================================
 * La principal se corta. El anillo del leash está pasado por LAS DOS cintas
 * —una práctica real de rigging redundante—, así que no hay ninguna holgura
 * de leash nueva que tomar: lo que había entre el arnés y el anillo sigue
 * exactamente igual que antes de la falla. Lo único que cambia es DE QUÉ
 * cinta cuelga el anillo.
 *
 * Secuencia:
 *
 *   1. Mientras la principal aguanta, el anillo está a la profundidad que
 *      la principal tiene bajo la carga de la persona en ese instante
 *      (`mainDepthAtFailure`). La backup, rigueada con holgura (más larga que
 *      el vano a propósito, para no compartir carga en uso normal), está en
 *      reposo bastante más abajo (`backupRestDepth`).
 *
 *   2. Al cortarse la principal, el anillo (y con él el leash, el arnés y la
 *      persona, todo eso ya tenso, sin holgura propia que sumar) cae en
 *      CAÍDA LIBRE hasta agotar ese desnivel:
 *        freeFall = backupRestDepth − mainDepthAtFailure
 *
 *   3. Frenado ("la dinamización de la backup"): a partir de ahí, la backup
 *      se estira bajo la fuerza F igual que cualquier cinta elástica —mismo
 *      solver que la principal (`lineStateFor`), con el largo de backup
 *      rigueado como largo sin estirar y su propio material—, y el mismo
 *      balance de energía de `energyFall.ts` da la fuerza pico.
 *
 *   4. Postura al fallar: "parado" y "sentado" dan a propósito el MISMO
 *      número. Un modelo de carga puntual 1D no puede distinguir de dónde
 *      sale el peso que carga la cinta, sólo cuánto es — y sentado o parado,
 *      es el mismo peso corporal. Lo que sí cambia la física es si la
 *      principal estaba cargada de forma estática o en el fondo de un
 *      rebote, donde la carga real es varias veces el peso corporal (ver
 *      BACKUP_BOUNCE_LOAD_FACTOR en constants.ts): eso hace que
 *      `mainDepthAtFailure` sea más profundo, y por lo tanto la caída libre
 *      hasta la backup, más corta.
 *
 * La backup no tiene tensión propia — no lleva tensor, y no se tensa a mano
 * más allá de lo justo para riguearla — precisamente PORQUE es más larga que
 * la principal: ese exceso de largo es lo que hace que, colgando de su
 * propio peso nomás, quede floja. La tensión real aparece recién cuando el
 * peso de la persona la carga durante la caída, y ahí es donde importa su
 * propia elasticidad (su `backupElongationPct`): mientras más se estira por
 * unidad de fuerza, más energía absorbe y más despacio frena.
 *
 * Por eso el largo rigueado (`backupLength`) se toma DIRECTAMENTE como su
 * largo sin estirar, y la tensión de reposo se DEDUCE de él (no al revés,
 * como en la principal): dado ese largo y ese peso propio, hay una única
 * tensión con la que puede estar colgando en equilibrio bajo los anclajes.
 * Para una cinta liviana con mucho exceso de largo, esa tensión de
 * equilibrio es baja y el sag de reposo, grande — a veces mayor que la
 * altura de anclaje. No es un error: es lo que de verdad le pasa a una
 * backup así, sin nadie tensándola.
 */

/** Construye el `SolvedRig` de la backup: mismo tipo que la principal, pero
 *  con su propio largo y material, y sin pretensión propia. */
export function prepareBackupRig(input: RigInput): SolvedRig {
  const L = Math.max(input.span, 0.01);
  const a = Math.min(Math.max(input.personPos, 0), 1) * L;
  const unstretched = Math.max(input.backupLength, 0.01);

  const elong = Math.max(input.backupElongationPct, 0.05) / 100;
  const EA = WEBBING_REF_TENSION_N / elong;
  const w = (input.backupWeightGm / 1000) * G;
  const loading = (P: number): Loading => ({ span: L, w, P, a });
  const pretensionN = restTensionForLength(loading(0), unstretched, EA);

  return {
    loading,
    unstretched,
    EA,
    pretensionN,
    span: L,
    stateFor: (P: number) => lineStateFor(loading(P), unstretched, EA, pretensionN),
    sagAtLoadFor: (P: number) => sagAtLoadFast(loading(P), unstretched, EA, pretensionN),
  };
}

/**
 * Sólo tiene sentido si el anillo puede estar pasado por las dos cintas: hace
 * falta el leash (es lo que conecta a la persona con lo que sea que la
 * frene) y que haya backup rigueada. Sin eso, `solveBackupFall` no resuelve
 * la búsqueda de energía —cara, un barrido de cientos de puntos— y devuelve
 * un resultado neutro.
 */
export function backupFallApplies(input: RigInput): boolean {
  return input.usesLeash && input.backupLength > 0;
}

const EMPTY_LINE_STATE = { H: 0, anchorTensionN: 0, thetaAnchor: 0, sagAtLoad: 0, sagMax: 0, sagMaxX: 0, arcLength: 0, strain: 0, profile: [] };

function neutralBackupFall(): BackupFallResult {
  return {
    mainDepthAtFailure: 0,
    backupRestDepth: 0,
    freeFallDistance: 0,
    peakForceN: 0,
    peakForceBodyWeights: 0,
    peakBackupTensionN: 0,
    peakAnchorTensionN: 0,
    dynamicSag: 0,
    personLowestDepth: 0,
    lowestBodyPoint: 0,
    bodyGroundClearance: 0,
    hitsGround: false,
    dynamicStrain: 0,
    overElongated: false,
    peakLineState: EMPTY_LINE_STATE,
    trajectory: [],
  };
}

export function solveBackupFall(
  input: RigInput,
  mainRig: SolvedRig = prepareRig(input),
  backupRigArg?: SolvedRig,
): BackupFallResult {
  // Un parámetro opcional en vez de un default: `prepareBackupRig` hace su
  // propia bisección (restTensionForLength), y un default de JS se evalúa
  // siempre al llamar aunque el cuerpo de la función nunca llegue a usarlo
  // (por el return temprano de arriba) — así que construirlo ahí arriba lo
  // haría incluso cuando no aplica.
  if (!backupFallApplies(input)) return neutralBackupFall();
  const backupRig = backupRigArg ?? prepareBackupRig(input);

  const m = Math.max(input.personMassKg, 0.1);
  const W = m * G;
  const harnessHeight = WAIST_RATIO * Math.max(input.personHeight, 0.5);
  const feetBelowHarness = harnessHeight;

  const failureLoadN = input.backupFallStart === 'bouncing' ? W * BACKUP_BOUNCE_LOAD_FACTOR : W;
  const mainDepthAtFailure = mainRig.sagAtLoadFor(failureLoadN);

  const z0 = mainDepthAtFailure - harnessHeight;
  const backupRestDepth = backupRig.sagAtLoadFor(0);
  const freeFall = Math.max(backupRestDepth - mainDepthAtFailure, 0);
  const depthFor = (F: number) => backupRig.sagAtLoadFor(F);

  const { peakForceN, personLowestDepth, trajectory } = solveEnergyFall({ m, z0, freeFall, depthFor });

  const peakLineState = backupRig.stateFor(peakForceN);
  const dynamicSag = peakLineState.sagAtLoad;
  const lowestBodyPoint = personLowestDepth + feetBelowHarness;

  return {
    mainDepthAtFailure,
    backupRestDepth,
    freeFallDistance: freeFall,
    peakForceN,
    peakForceBodyWeights: peakForceN / W,
    peakBackupTensionN: peakLineState.H,
    peakAnchorTensionN: peakLineState.anchorTensionN,
    dynamicSag,
    personLowestDepth,
    lowestBodyPoint,
    bodyGroundClearance: input.anchorHeight - lowestBodyPoint,
    hitsGround: lowestBodyPoint >= input.anchorHeight,
    dynamicStrain: peakLineState.strain,
    overElongated: peakLineState.strain * 100 > input.elongationLimitPct,
    peakLineState,
    trajectory,
  };
}
