import { prepareRig, solveStatic } from './staticSolver';
import { solveFall } from './fallSolver';
import { backupFallApplies, solveBackupFall, prepareBackupRig } from './backupFallSolver';
import {
  treeStiffnessNPerM,
  prepareTreeRig,
  combineStatic,
  combineFall,
  combineBackupFall,
} from './treeAnchorSolver';
import { TREE_DEFLECTION_WARN_M } from './constants';
import type { CalcResult, RigInput } from './types';

export * from './types';
export * from './constants';
export { prepareRig, solveStatic, minPretensionForClearance, tensionAtLoadFast } from './staticSolver';
export { solveFall } from './fallSolver';
export { backupFallApplies, prepareBackupRig, solveBackupFall } from './backupFallSolver';
export { treeStiffnessNPerM, prepareTreeRig } from './treeAnchorSolver';

export function calculate(input: RigInput): CalcResult {
  const rig = prepareRig(input);
  const backupRig = backupFallApplies(input) ? prepareBackupRig(input) : undefined;
  const stat0 = solveStatic(input, rig);
  const fall0 = solveFall(input, rig);
  const backupFall0 = solveBackupFall(input, rig, backupRig);

  let stat = { ...stat0, treeDeflectionM: 0, treeExtraSagM: 0 };
  let fall = { ...fall0, treeDeflectionAtPeakM: 0, treeExtraSagAtPeakM: 0, treeSoftenedPeakAnchorTensionN: 0 };
  let backupFall = { ...backupFall0, treeDeflectionAtPeakM: 0, treeExtraSagAtPeakM: 0, treeSoftenedPeakAnchorTensionN: 0 };

  if (input.treeAnchor) {
    const kTree = treeStiffnessNPerM(input.treeModulusGPa, input.treeDiameterCm, input.treeSlingHeightM);
    const treeRig = prepareTreeRig(input, rig);
    stat = combineStatic(input, rig.span, kTree, stat0, solveStatic(input, treeRig));
    fall = combineFall(input, rig.span, kTree, fall0, solveFall(input, treeRig));
    if (backupRig) {
      const treeBackupRig = prepareTreeRig(input, backupRig);
      backupFall = combineBackupFall(input, rig.span, kTree, backupFall0, solveBackupFall(input, treeRig, treeBackupRig));
    }
  }

  const warnings: string[] = [];
  if (input.backupLength > 0 && input.backupLength < input.span) warnings.push('backupShorterThanMain');
  if (stat.overElongated) warnings.push('staticOverElongation');
  if (fall.overElongated && input.usesLeash) warnings.push('dynamicOverElongation');
  if (stat.groundClearance <= 0) warnings.push('staticGroundContact');
  if (fall.hitsGround && input.usesLeash) warnings.push('fallGroundImpact');
  if (input.usesLeash && fall.peakAnchorTensionN > 25_000) warnings.push('highAnchorLoad');
  if (backupFallApplies(input) && backupFall.overElongated) warnings.push('backupOverElongation');
  if (backupFallApplies(input) && backupFall.hitsGround) warnings.push('backupFallGroundImpact');
  if (backupFallApplies(input) && backupFall.peakAnchorTensionN > 25_000) warnings.push('highBackupAnchorLoad');
  if (
    input.treeAnchor &&
    Math.max(stat.treeDeflectionM, fall.treeDeflectionAtPeakM, backupFall.treeDeflectionAtPeakM) > TREE_DEFLECTION_WARN_M
  )
    warnings.push('treeAnchorLargeDeflection');

  return { static: stat, fall, backupFall, warnings };
}

/** Valores por defecto: el escenario "midline" del proyecto original. */
export const DEFAULT_INPUT: RigInput = {
  span: 74,
  pretensionN: 5000,
  personMassKg: 80,
  personHeight: 1.7,
  personPos: 0.5,
  anchorHeight: 14,
  mainWeightGm: 65,
  // El backup va con holgura, más largo que la principal: 20 % por defecto.
  backupLength: 74 * 1.2,
  backupWeightGm: 55,
  // Mismo material que la principal por defecto (poliéster estándar, 4 %).
  backupElongationPct: 4,
  webbingElongationPct: 4,
  elongationLimitPct: 8,
  usesLeash: true,
  // Largo útil, del anillo al arnés y con los nudos ya hechos.
  leashLength: 1.0,
  backupFallStart: 'standing',
  treeAnchor: false,
  treeSlingHeightM: 2,
  treeDiameterCm: 25,
  treeModulusGPa: 8,
};
