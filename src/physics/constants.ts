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
 */
export const DISCIPLINE_PRESETS: DisciplinePreset[] = [
  { id: 'trickline', span: 20,  pretensionKN: 4.0, anchorHeight: 1.2 },
  { id: 'midline',   span: 70,  pretensionKN: 3.5, anchorHeight: 13 },
  { id: 'longline',  span: 60,  pretensionKN: 2.0, anchorHeight: 2.5 },
  { id: 'highline',  span: 100, pretensionKN: 4.0, anchorHeight: 60 },
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
  /** % de elongación medido a `refForceN`. */
  elongationPct: number;
  /** La carga a la que ESE porcentaje está medido (N). Sin este dato el % no
   *  significa nada: las normas miden a cargas bajísimas y la cuerda no es lineal. */
  refForceN: number;
}

/**
 * Calibrados en el rango donde de verdad ocurre una caída de leash (2–7 kN), no
 * en el punto de ensayo de la norma.
 *
 * Contraste contra las normas en sus propios puntos de medición:
 *   · dinámica  EA 20 kN -> 3,9 % con 80 kg   (EN 892 admite hasta 10 %)
 *   · semiestática EA 75 kN -> 2,0 % con 150 kg (EN 1891 admite hasta 5 %)
 * O sea, la recta queda MÁS RÍGIDA que la cuerda real a carga baja, que es la
 * dirección conservadora para la fuerza pico.
 */
export const LEASH_PRESETS: LeashPreset[] = [
  { id: 'dynamic',    label: 'Cuerda dinámica (EN 892, 9,5–10 mm)', elongationPct: 30,  refForceN: 6000 },
  { id: 'classic',    label: 'Leash clásico (dinámica en tubular)', elongationPct: 24,  refForceN: 6000 },
  { id: 'semistatic', label: 'Cuerda semiestática (EN 1891)',       elongationPct: 8,   refForceN: 6000 },
  { id: 'dyneema',    label: 'Dyneema / amsteel',                   elongationPct: 1.5, refForceN: 6000 },
];
