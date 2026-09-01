import { prepareRig, solveStatic } from './staticSolver';
import { solveFall } from './fallSolver';
import type { CalcResult, RigInput } from './types';

export * from './types';
export * from './constants';
export { prepareRig, solveStatic } from './staticSolver';
export { solveFall } from './fallSolver';

export function calculate(input: RigInput): CalcResult {
  const rig = prepareRig(input);
  const stat = solveStatic(input, rig);
  const fall = solveFall(input, rig);

  const warnings: string[] = [];
  if (input.backupLength > 0 && input.backupLength < input.span) warnings.push('backupShorterThanMain');
  if (stat.overElongated) warnings.push('staticOverElongation');
  if (fall.overElongated && input.usesLeash) warnings.push('dynamicOverElongation');
  if (stat.groundClearance <= 0) warnings.push('staticGroundContact');
  if (fall.hitsGround && input.usesLeash) warnings.push('fallGroundImpact');
  if (input.usesLeash && fall.peakAnchorTensionN > 25_000) warnings.push('highAnchorLoad');

  return { static: stat, fall, warnings };
}

/** Valores por defecto: el escenario "midline" del proyecto original. */
export const DEFAULT_INPUT: RigInput = {
  span: 70,
  pretensionN: 3500,
  personMassKg: 80,
  personHeight: 1.67,
  personPos: 0.5,
  anchorHeight: 13,
  mainWeightGm: 65,
  // El backup va con holgura, más largo que la principal: 20 % por defecto.
  backupLength: 70 * 1.2,
  backupWeightGm: 55,
  webbingElongationPct: 4,
  elongationLimitPct: 8,
  usesLeash: true,
  // Largo útil, del anillo al arnés y con los nudos ya hechos.
  leashLength: 1.5,
};
