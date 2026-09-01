/** Configuración física completa de la línea y del sistema de caída. */
export interface RigInput {
  /** Distancia entre anclajes (m). */
  span: number;
  /** Pretensión riggeada, sin nadie en la línea (N). */
  pretensionN: number;
  /** Masa de la persona (kg). */
  personMassKg: number;
  /** Estatura de la persona (m). De acá salen la altura del arnés sobre la
   *  cinta y cuánto cuelga el cuerpo por debajo del arnés. */
  personHeight: number;
  /** Posición de la persona a lo largo del vano, 0..1. */
  personPos: number;
  /** Altura de los anclajes sobre el suelo (m). */
  anchorHeight: number;

  /** Peso lineal de la cinta principal (g/m). */
  mainWeightGm: number;
  /** Largo de la línea de backup (m); 0 = sin backup. */
  backupLength: number;
  /** Peso lineal del backup (g/m). */
  backupWeightGm: number;

  /** Elongación de la cinta en % a WEBBING_REF_TENSION_N. */
  webbingElongationPct: number;
  /** Límite de elongación admisible que el usuario declara (%). */
  elongationLimitPct: number;

  /**
   * Si se camina amarrado. En trickline y longline no se usa leash, así que el
   * cálculo de caída no aplica.
   */
  usesLeash: boolean;
  /** Largo ÚTIL del leash (m): del anillo al arnés, con los nudos ya hechos. */
  leashLength: number;
}

/** Estado de la línea para una carga puntual dada. */
export interface LineState {
  /** Componente horizontal de la tensión (N). Constante a lo largo del vano. */
  H: number;
  /** Tensión real en el anclaje, H/cos(θ) (N). */
  anchorTensionN: number;
  /** Ángulo de la cinta respecto de la horizontal en el anclaje (rad). */
  thetaAnchor: number;
  /** Profundidad de la cinta bajo la línea de anclajes, en la posición de la persona (m). */
  sagAtLoad: number;
  /** Profundidad máxima de la cinta bajo la línea de anclajes (m). */
  sagMax: number;
  /** Posición x del punto más bajo (m). */
  sagMaxX: number;
  /** Longitud de arco de la cinta cargada (m). */
  arcLength: number;
  /** Elongación respecto de la longitud sin estirar (fracción, no %). */
  strain: number;
  /** Perfil muestreado para dibujar: pares [x, profundidad] en metros. */
  profile: Array<[number, number]>;
}

export interface StaticResult {
  /** Línea vacía: sólo su propio peso. */
  empty: LineState;
  /** Línea con la persona de pie. */
  loaded: LineState;
  /** sag / vano, en % — el número que explica la forma en V vs. recta. */
  sagRatioPct: number;
  /** Altura libre bajo el punto más bajo de la cinta (m). Negativa = toca el suelo. */
  groundClearance: number;
  /** Longitud sin estirar de la cinta (m). */
  unstretchedLength: number;
  /** Rigidez axial de la cinta (N). */
  webbingEA: number;
  /** true si la elongación supera el límite declarado. */
  overElongated: boolean;
}

export interface FallResult {
  /** Fuerza pico en el leash / punto de amarre (N). */
  peakForceN: number;
  /** Fuerza pico en múltiplos del peso corporal de la persona. */
  peakForceBodyWeights: number;
  /** Tensión horizontal pico de la cinta (N). */
  peakLineTensionN: number;
  /** Tensión pico en el anclaje (N). */
  peakAnchorTensionN: number;
  /** Sag máximo de la cinta durante la caída (m). */
  dynamicSag: number;
  /** Cuánto más se hundió la cinta respecto del estado de pie (m). */
  extraSag: number;
  /** Profundidad del punto más bajo alcanzado por la persona, bajo los anclajes (m). */
  personLowestDepth: number;
  /** Altura libre al suelo en ese punto (m). Negativa = impacto. */
  fallGroundClearance: number;
  /** true si la persona llega al suelo. */
  hitsGround: boolean;
  /** Caída total recorrida por la persona, desde de pie hasta el punto más bajo (m). */
  totalDrop: number;
  /** Tramo de caída libre antes de que el leash tome carga (m). */
  freeFallDistance: number;
  /** Cuánto sobresale el arnés sobre la cinta estando parado (m). */
  harnessHeight: number;
  /** Cuánto cuelga el cuerpo por debajo del arnés estando colgado (m). */
  feetBelowHarness: number;
  /** Profundidad del punto más bajo del CUERPO (los pies), bajo los anclajes (m).
   *  Es lo que toca el suelo, no el punto del arnés. */
  lowestBodyPoint: number;
  /** Altura libre desde los pies hasta el suelo (m). Negativa = impacto. */
  bodyGroundClearance: number;
  /** Fall factor clásico: caída libre / largo del leash. */
  fallFactor: number;
  /** Elongación dinámica de la cinta (fracción). */
  dynamicStrain: number;
  /** true si la elongación dinámica supera el límite declarado. */
  overElongated: boolean;
  /** Estado de la cinta en el instante de fuerza máxima. */
  peakLineState: LineState;
  /** Trayectoria para animar: profundidad de la persona en función del avance 0..1. */
  trajectory: number[];
}

export interface CalcResult {
  static: StaticResult;
  fall: FallResult;
  warnings: string[];
}
