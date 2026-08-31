/** Aceleración de la gravedad, valor estándar (m/s²). */
export const G = 9.80665;

/** Tensión de referencia a la que se especifica la elasticidad de la cinta (N). */
export const WEBBING_REF_TENSION_N = 10_000;

/** Tensión de referencia a la que se especifica la elasticidad del leash (N). */
export const LEASH_REF_TENSION_N = 5_000;

export interface DisciplinePreset {
  id: string;
  span: number;          // m
  pretensionKN: number;  // kN
  anchorHeight: number;  // m
}

/**
 * Cuatro escenarios reales. Sirven para ver de un click el punto central:
 * el sag absoluto cambia poco entre ellos, pero la relación sag/largo —
 * que es lo que el ojo lee como "V" o como "recta" — cambia casi 10x.
 */
export const DISCIPLINE_PRESETS: DisciplinePreset[] = [
  { id: 'trickline', span: 20,  pretensionKN: 4.0,  anchorHeight: 1.0 },
  { id: 'midline',   span: 70,  pretensionKN: 3.0,  anchorHeight: 13 },
  { id: 'highline',  span: 100, pretensionKN: 10.0, anchorHeight: 60 },
  { id: 'longline',  span: 200, pretensionKN: 14.0, anchorHeight: 8.0 },
];

export interface WebbingPreset {
  id: string;
  label: string;
  gramsPerMeter: number;
  /** % de elongación a WEBBING_REF_TENSION_N. */
  elongationPct: number;
}

export const WEBBING_PRESETS: WebbingPreset[] = [
  { id: 'type18',  label: 'Type-18 / nylon',      gramsPerMeter: 65, elongationPct: 8.0 },
  { id: 'poly',    label: 'Poliéster estándar',   gramsPerMeter: 65, elongationPct: 4.0 },
  { id: 'lowstretch', label: 'Low-stretch (poly)', gramsPerMeter: 72, elongationPct: 2.5 },
  { id: 'dyneema', label: 'Dyneema / híbrida',    gramsPerMeter: 58, elongationPct: 1.2 },
];

export interface LeashPreset {
  id: string;
  label: string;
  /** % de elongación a LEASH_REF_TENSION_N. */
  elongationPct: number;
}

export const LEASH_PRESETS: LeashPreset[] = [
  { id: 'dyneema', label: 'Dyneema (estático)', elongationPct: 3 },
  { id: 'nylon',   label: 'Nylon (dinámico)',   elongationPct: 10 },
  { id: 'rope',    label: 'Cuerda dinámica',    elongationPct: 20 },
];
