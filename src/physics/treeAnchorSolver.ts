import { tensionAtLoadFast } from './staticSolver';
import type { SolvedRig } from './staticSolver';
import type { RigInput, LineState, StaticResult, FallResult, BackupFallResult } from './types';

const MAX_SPAN_SHRINK_FRACTION = 0.4;

/**
 * Rigidez de un árbol modelado como viga en voladizo.
 * k = 3·E·I / L³, donde E es el módulo elástico, I el momento de inercia,
 * y L la altura de la eslinga.
 *
 * Para una sección circular:
 *   I = π·d⁴ / 64
 *   k = 3·E·π·d⁴ / (64·L³)
 *
 * Con E en GPa, d en cm, L en m:
 *   k [N/m] = 3·(E·10⁹) · (π·(d·0.01)⁴/64) / L³
 *           = 3·E·10⁹ · π · d⁴·10⁻⁸ / (64·L³)
 *           = 3·π·E·d⁴·10¹ / (64·L³)
 *           = 3·π·E·d⁴ / (6.4·L³)
 */
export function treeStiffnessNPerM(modulusGPa: number, diameterCm: number, slingHeightM: number): number {
  const E = modulusGPa * 1e9; // Pa
  const d = diameterCm * 0.01; // m
  const L = Math.max(slingHeightM, 0.1);
  const I = (Math.PI * d ** 4) / 64;
  return (3 * E * I) / (L ** 3);
}

/**
 * Envuelve un SolvedRig para que responda a la flexión del tronco.
 * Para cada carga P, calcula la tensión al vano rígido, estima la flexión
 * con delta = anchorTensionN / k, y resuelve una vez más con span efectivo
 * = span − 2·delta (limitado a evitar degeneración).
 */
export function prepareTreeRig(input: RigInput, baseRig: SolvedRig): SolvedRig {
  if (!input.treeAnchor) return baseRig;

  const kTree = treeStiffnessNPerM(input.treeModulusGPa, input.treeDiameterCm, input.treeSlingHeightM);

  return {
    ...baseRig,
    loading: (P: number) => {
      const rigid = baseRig.loading(P);
      const { anchorTensionN } = tensionAtLoadFast(rigid, baseRig.unstretched, baseRig.EA, baseRig.pretensionN);
      const delta = anchorTensionN / kTree;
      const maxShrink = baseRig.span * MAX_SPAN_SHRINK_FRACTION;
      const shrunk = Math.min(delta, maxShrink);
      const span = Math.max(baseRig.span - 2 * shrunk, 0.01);
      return { ...rigid, span };
    },
    sagAtLoadFor: (P: number) => {
      const rigid = baseRig.loading(P);
      const { anchorTensionN } = tensionAtLoadFast(rigid, baseRig.unstretched, baseRig.EA, baseRig.pretensionN);
      const delta = anchorTensionN / kTree;
      return baseRig.stateFor(P).sagAtLoad + delta;
    },
  };
}

/**
 * Devuelve la deflexión del árbol en un punto de carga.
 * Es delta = anchorTensionN / k.
 */
export function treeDeflectionAt(
  input: RigInput,
  baseRig: SolvedRig,
  P: number,
): number {
  if (!input.treeAnchor) return 0;
  const kTree = treeStiffnessNPerM(input.treeModulusGPa, input.treeDiameterCm, input.treeSlingHeightM);
  const rigid = baseRig.loading(P);
  const { anchorTensionN } = tensionAtLoadFast(rigid, baseRig.unstretched, baseRig.EA, baseRig.pretensionN);
  return Math.max(anchorTensionN / kTree, 0);
}

/**
 * Combina LineState rígido y árbol: toma el peor caso de cada campo,
 * nunca mostrando menos sag ni menos fuerza de lo que sería anclaje rígido.
 */
function combineLineState(rigid: LineState, tree: LineState): LineState {
  return {
    H: Math.max(rigid.H, tree.H),
    anchorTensionN: Math.max(rigid.anchorTensionN, tree.anchorTensionN),
    thetaAnchor: Math.max(rigid.thetaAnchor, tree.thetaAnchor),
    sagAtLoad: Math.max(rigid.sagAtLoad, tree.sagAtLoad),
    sagMax: Math.max(rigid.sagMax, tree.sagMax),
    sagMaxX: rigid.sagMax >= tree.sagMax ? rigid.sagMaxX : tree.sagMaxX,
    arcLength: Math.max(rigid.arcLength, tree.arcLength),
    strain: Math.max(rigid.strain, tree.strain),
    profile: rigid.sagMax >= tree.sagMax ? rigid.profile : tree.profile,
  };
}

export function combineStatic(
  _input: RigInput,
  _rigidSpan: number,
  kTree: number,
  rigid: StaticResult,
  tree: StaticResult,
): StaticResult {
  const delta = Math.max(rigid.loaded.anchorTensionN / kTree, 0);

  return {
    ...rigid,
    loaded: combineLineState(rigid.loaded, tree.loaded),
    sagRatioPct: Math.max(rigid.sagRatioPct, tree.sagRatioPct),
    groundClearance: Math.min(rigid.groundClearance, tree.groundClearance),
    treeDeflectionM: delta,
    treeExtraSagM: Math.max(0, tree.loaded.sagAtLoad - rigid.loaded.sagAtLoad),
  };
}

export function combineFall(
  _input: RigInput,
  _rigidSpan: number,
  kTree: number,
  rigid: FallResult,
  tree: FallResult,
): FallResult {
  const delta = Math.max(rigid.peakLineState.anchorTensionN / kTree, 0);

  return {
    ...rigid,
    peakLineState: combineLineState(rigid.peakLineState, tree.peakLineState),
    dynamicSag: Math.max(rigid.dynamicSag, tree.dynamicSag),
    extraSag: Math.max(rigid.extraSag, tree.extraSag),
    personLowestDepth: Math.max(rigid.personLowestDepth, tree.personLowestDepth),
    fallGroundClearance: Math.min(rigid.fallGroundClearance, tree.fallGroundClearance),
    peakAnchorTensionN: Math.max(rigid.peakAnchorTensionN, tree.peakAnchorTensionN),
    hitsGround: rigid.hitsGround || tree.hitsGround,
    treeDeflectionAtPeakM: delta,
    treeExtraSagAtPeakM: Math.max(0, tree.dynamicSag - rigid.dynamicSag),
    treeSoftenedPeakAnchorTensionN: tree.peakAnchorTensionN,
  };
}

export function combineBackupFall(
  _input: RigInput,
  _rigidSpan: number,
  kTree: number,
  rigid: BackupFallResult,
  tree: BackupFallResult,
): BackupFallResult {
  const delta = Math.max(rigid.peakLineState.anchorTensionN / kTree, 0);

  return {
    ...rigid,
    peakLineState: combineLineState(rigid.peakLineState, tree.peakLineState),
    dynamicSag: Math.max(rigid.dynamicSag, tree.dynamicSag),
    personLowestDepth: Math.max(rigid.personLowestDepth, tree.personLowestDepth),
    lowestBodyPoint: Math.max(rigid.lowestBodyPoint, tree.lowestBodyPoint),
    bodyGroundClearance: Math.min(rigid.bodyGroundClearance, tree.bodyGroundClearance),
    peakAnchorTensionN: Math.max(rigid.peakAnchorTensionN, tree.peakAnchorTensionN),
    hitsGround: rigid.hitsGround || tree.hitsGround,
    treeDeflectionAtPeakM: delta,
    treeExtraSagAtPeakM: Math.max(0, tree.dynamicSag - rigid.dynamicSag),
    treeSoftenedPeakAnchorTensionN: tree.peakAnchorTensionN,
  };
}
