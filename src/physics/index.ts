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

  // Por debajo de esta altura no existe una configuración con leash que tenga
  // sentido (en una trickline nadie se amarra), así que el impacto contra el
  // suelo es cierto pero trivial: se informa en vez de alarmar.
  const leashRelevant = input.anchorHeight >= input.leashLength + 2;

  const warnings: string[] = [];
  if (!leashRelevant) warnings.push('leashNotRelevant');
  if (input.backupLength > 0 && input.backupLength < input.span) warnings.push('backupShorterThanMain');
  if (stat.overElongated) warnings.push('staticOverElongation');
  if (fall.overElongated) warnings.push('dynamicOverElongation');
  if (stat.groundClearance <= 0) warnings.push('staticGroundContact');
  if (fall.hitsGround && leashRelevant) warnings.push('fallGroundImpact');
  if (fall.peakAnchorTensionN > 25_000) warnings.push('highAnchorLoad');

  return { static: stat, fall, warnings };
}

/** Valores por defecto: el escenario "midline" del proyecto original. */
export const DEFAULT_INPUT: RigInput = {
  span: 70,
  pretensionN: 3000,
  personMassKg: 80,
  personPos: 0.5,
  anchorHeight: 13,
  mainWeightGm: 65,
  backupLength: 0,
  backupWeightGm: 55,
  webbingElongationPct: 4,
  elongationLimitPct: 8,
  leashLength: 2,
  leashElongationPct: 3,
  harnessHeight: 1,
};
