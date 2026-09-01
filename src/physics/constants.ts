/** Aceleración de la gravedad, valor estándar (m/s²). */
export const G = 9.80665;

/** Tensión de referencia a la que se especifica la elasticidad de la cinta (N). */
export const WEBBING_REF_TENSION_N = 10_000;

/**
 * Altura de la cintura como fracción de la estatura. Sirve para dos cosas a la
 * vez: cuánto sobresale el arnés por encima de la cinta estando parado, y cuánto
 * cuelga el cuerpo por debajo del arnés estando colgado.
 */
export const WAIST_RATIO = 0.58;

export interface DisciplinePreset {
  id: string;
  span: number;          // m
  pretensionKN: number;  // kN
  anchorHeight: number;  // m
  /** Si la disciplina se camina amarrado. Trickline y longline no. */
  usesLeash: boolean;
  /** Si el rig lleva línea de backup. */
  usesBackup: boolean;
  /** Overrides opcionales; si faltan, el preset no toca ese campo. */
  personHeight?: number; // m
  leashLength?: number;  // m
}

/**
 * Cuatro escenarios reales. Sirven para ver de un click el punto central:
 * el sag absoluto cambia poco entre ellos, pero la relación sag/largo —
 * que es lo que el ojo lee como "V" o como "recta" — cambia casi 10x.
 */
/**
 * Los nombres son disciplinas, no una escala creciente de largo: el longline es
 * una cinta de plaza anclada a árboles de unos 2,5 m, y puede ser más corta que
 * un midline.
 *
 * Trickline y longline se caminan sin amarrarse y sin backup, así que en esos
 * dos no tiene sentido ni el cálculo de caída ni el peso de la línea de backup.
 *
 * La trickline va tensada durísimo porque es la modalidad de saltos: en reposo
 * suele estar entre 8 y 11 kN, y durante los saltos los picos sobre anclajes y
 * herrajes llegan con facilidad a 12–15 kN, con registros de hasta 16 kN en
 * caídas secas de atletas pesados.
 */
export const DISCIPLINE_PRESETS: DisciplinePreset[] = [
  { id: 'trickline', span: 20,  pretensionKN: 10.0, anchorHeight: 1.2, usesLeash: false, usesBackup: false },
  { id: 'midline',   span: 74,  pretensionKN: 5.0,  anchorHeight: 14,  usesLeash: true,  usesBackup: true, personHeight: 1.7, leashLength: 1.0 },
  { id: 'longline',  span: 50,  pretensionKN: 2.3,  anchorHeight: 3.0, usesLeash: false, usesBackup: false },
  { id: 'highline',  span: 100, pretensionKN: 4.0,  anchorHeight: 60,  usesLeash: true,  usesBackup: true },
];

/** Picos medidos sobre los anclajes durante saltos de trickline (kN). */
export const TRICKLINE_JUMP_PEAK_KN = { typical: [12, 15] as const, extreme: 16 };

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

