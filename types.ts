
export type SagCalculationResult = number | string | null;
// number: calculated SAG in meters
// string: error message or specific condition (e.g., "infinite sag")
// null: initial state or after clearing

export interface StretchInfo {
  amountMeters: number;
  percent: number;
  totalLength: number;
  limitPercent: number;
}
