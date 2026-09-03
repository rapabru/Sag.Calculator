import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CalcResult, RigInput } from '../physics';
import { useTranslation } from '../i18n/useTranslation';
import { PAD_B, PAD_L, PAD_R, PAD_T, VB_W, computeChartGeometry } from './chartGeometry';
import { PersonFigure } from './PersonFigure';

/**
 * GRÁFICO A ESCALA REAL
 * =====================
 * La escala se calcula acá, en JS, como un único número `scale` en px/metro que
 * se usa para el eje horizontal y para el vertical. Esa es toda la garantía de
 * que el dibujo sea 1:1: no hay dos escalas que puedan desincronizarse.
 *
 * Con eso, el efecto que se ve es el real: una cinta corta y floja se dibuja
 * como una V profunda y una larga y tensa como una casi-recta, porque lo que
 * cambia entre ellas es la proporción sag/largo.
 *
 * El slider de exageración multiplica sólo la profundidad, para poder mirar de
 * cerca un sag muy chico. Mientras vale 1, el dibujo no miente.
 */

/** Debajo de esto la figura no se leería, así que se deja de respetar la escala. */
const MIN_PERSON_PX = 20;

interface Props {
  input: RigInput;
  result: CalcResult;
  exaggeration: number;
  showFall: boolean;
  /** Profundidad animada del arnés (m); null = mostrar el punto más bajo. */
  animDepth: number | null;
  onPersonPosChange: (pos: number) => void;
  onPersonPosCommit?: () => void;
}

type Pt = [number, number];

/** Evalúa un perfil muestreado en un x arbitrario, por interpolación lineal. */
function sampleProfile(profile: Pt[], x: number): number {
  if (x <= profile[0][0]) return profile[0][1];
  const last = profile[profile.length - 1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = profile[lo];
  const [x1, y1] = profile[hi];
  return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function niceStep(range: number, targetCount: number): number {
  if (range <= 0) return 1;
  const raw = range / targetCount;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return mult * mag;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1) return v.toFixed(2);
  if (a < 10) return v.toFixed(1);
  return v.toFixed(0);
}

export const SagChart: React.FC<Props> = ({
  input,
  result,
  exaggeration,
  showFall,
  animDepth,
  onPersonPosChange,
  onPersonPosCommit,
}) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  // El viewBox mide, en px CSS, lo mismo que el contenedor real. Así una
  // unidad de viewBox equivale a ~1 px de pantalla sin importar el ancho:
  // en un celular angosto, sin esto, el viewBox fijo de 1000 unidades se
  // comprime a un tercio y todo el dibujo —texto, la persona, los trazos—
  // encoge con él. VB_W (1000) queda como valor inicial hasta medir, así que
  // en SSR (sin layout real) el viewBox sigue siendo "0 0 1000 …".
  const [measuredW, setMeasuredW] = useState(VB_W);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setMeasuredW(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stat = result.static;
  const fall = result.fall;
  const span = Math.max(input.span, 0.01);
  const personX = Math.min(Math.max(input.personPos, 0), 1) * span;
  const animating = animDepth !== null;

  const geom = useMemo(
    () =>
      computeChartGeometry({
        span,
        staticDepth: stat.loaded.sagMax,
        // Se encuadra hasta los PIES, no hasta el arnés, o el cuerpo queda cortado.
        fallDepth: showFall ? fall.lowestBodyPoint : 0,
        groundDepth: input.anchorHeight,
        // La persona parada sobresale de la cinta: en una línea poco hundida su
        // cabeza queda por encima de la línea de anclajes.
        topExtent: Math.max(0, input.personHeight * 1.05 - stat.loaded.sagAtLoad),
        exaggeration,
        vbW: measuredW,
      }),
    [
      span,
      stat.loaded.sagMax,
      stat.loaded.sagAtLoad,
      showFall,
      fall.lowestBodyPoint,
      input.anchorHeight,
      input.personHeight,
      exaggeration,
      measuredW,
    ],
  );

  const { px, py } = geom;

  /**
   * Perfil de la cinta durante la caída. Arranca desde la cinta CARGADA —la
   * naranja, con la persona parada— y va hasta el pico. Físicamente la cinta
   * rebota hacia arriba al soltarte, pero mostrar ese rebote hace perder de
   * vista lo que importa, que es cuánto más se hunde respecto de donde estabas.
   */
  const fallProfile = useMemo(() => {
    if (!showFall) return null;
    const from = stat.loaded.profile;
    const peak = fall.peakLineState.profile;
    let mix = 1;
    if (animDepth !== null) {
      const engage = stat.loaded.sagAtLoad - fall.harnessHeight + fall.freeFallDistance;
      const denom = Math.max(fall.personLowestDepth - engage, 1e-6);
      mix = animDepth <= engage ? 0 : Math.min(Math.max((animDepth - engage) / denom, 0), 1);
    }
    const pts: Pt[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = (i / 140) * span;
      const a = sampleProfile(from, x);
      const b = sampleProfile(peak, x);
      pts.push([x, a + mix * (b - a)]);
    }
    return pts;
  }, [showFall, stat.loaded.profile, stat.loaded.sagAtLoad, fall, animDepth, span]);

  const toPath = useCallback(
    (pts: Pt[]) => pts.map(([x, d], i) => `${i ? 'L' : 'M'}${px(x).toFixed(2)} ${py(d).toFixed(2)}`).join(' '),
    [px, py],
  );

  const xStep = niceStep(span, 6);
  const yStep = niceStep(geom.bottom, 5);

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const vbX = ((e.clientX - rect.left) / rect.width) * geom.vbW;
      const pos = geom.mFromPx(vbX) / span;
      onPersonPosChange(Math.min(Math.max(pos, 0.02), 0.98));
    },
    [geom, span, onPersonPosChange],
  );

  // La exageración vertical no toca a la persona: sólo estira los ejes.
  const trueH = input.personHeight * geom.scale;
  const personSize = Math.max(trueH, MIN_PERSON_PX);
  const personClamped = trueH < MIN_PERSON_PX;

  const harnessDepth = animDepth ?? fall.personLowestDepth;
  const feetDepth = harnessDepth + fall.feetBelowHarness;
  const lineSagNow = fallProfile ? sampleProfile(fallProfile, personX) : 0;
  const groundY = py(geom.groundDepth);
  const bottomY = py(geom.bottom);
  const postBottom = geom.showGround ? groundY : bottomY;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${geom.vbW} ${geom.vbH}`}
      role="img"
      aria-label={t('chart.aria')}
      style={{ cursor: 'ew-resize' }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => dragging.current && handlePointer(e)}
      onPointerUp={() => {
        if (dragging.current) onPersonPosCommit?.();
        dragging.current = false;
      }}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* ---------- suelo ---------- */}
      {geom.showGround ? (
        <>
          <rect
            x={0}
            y={groundY}
            width={geom.vbW}
            height={Math.max(geom.vbH - PAD_B - groundY, 0)}
            fill="var(--ground)"
            opacity={0.55}
          />
          <line x1={0} y1={groundY} x2={geom.vbW} y2={groundY} stroke="var(--ground)" strokeWidth={2} />
          <text x={6} y={groundY - 5} fontSize={10} fill="var(--text-faint)">
            {t('chart.ground')}
          </text>
        </>
      ) : (
        <text x={6} y={geom.vbH - PAD_B + 26} fontSize={10} fill="var(--text-faint)">
          ↓ {t('chart.ground')} {fmt(geom.groundDepth)} m
        </text>
      )}

      {/* ---------- eje vertical: profundidad bajo los anclajes ---------- */}
      {Array.from({ length: Math.floor(geom.bottom / yStep) + 1 }, (_, i) => i * yStep).map((d) => (
        <g key={`y${d}`}>
          <line
            x1={PAD_L - 6}
            y1={py(d)}
            x2={geom.vbW - PAD_R}
            y2={py(d)}
            stroke="var(--border)"
            strokeWidth={0.7}
            strokeDasharray={d === 0 ? '' : '2 4'}
            opacity={d === 0 ? 1 : 0.65}
          />
          <text x={PAD_L - 10} y={py(d) + 3.4} fontSize={10} textAnchor="end" fill="var(--text-faint)">
            {fmt(d)}
          </text>
        </g>
      ))}
      <text
        x={12}
        y={PAD_T + geom.innerH / 2}
        fontSize={9.5}
        fill="var(--text-faint)"
        textAnchor="middle"
        transform={`rotate(-90 12 ${PAD_T + geom.innerH / 2})`}
        letterSpacing="0.12em"
      >
        SAG (m)
      </text>

      {/* ---------- eje horizontal ---------- */}
      {Array.from({ length: Math.floor(span / xStep) + 1 }, (_, i) => i * xStep).map((x) => (
        <g key={`x${x}`}>
          <line x1={px(x)} y1={bottomY} x2={px(x)} y2={bottomY + 5} stroke="var(--border-strong)" strokeWidth={0.9} />
          <text x={px(x)} y={bottomY + 17} fontSize={10} textAnchor="middle" fill="var(--text-faint)">
            {fmt(x)}
          </text>
        </g>
      ))}
      <text x={px(span / 2)} y={bottomY + 32} fontSize={9.5} textAnchor="middle" fill="var(--text-faint)" letterSpacing="0.12em">
        {fmt(span)} m
      </text>

      {/* ---------- anclajes ---------- */}
      {[0, span].map((x) => (
        <g key={`post${x}`}>
          <line x1={px(x)} y1={py(0)} x2={px(x)} y2={postBottom} stroke="var(--border-strong)" strokeWidth={4} strokeLinecap="round" />
          <circle cx={px(x)} cy={py(0)} r={3.6} fill="var(--text-dim)" />
        </g>
      ))}

      {/* ---------- cinta sin carga ---------- */}
      <path
        d={toPath(stat.empty.profile)}
        fill="none"
        stroke="var(--text-faint)"
        strokeWidth={1.2}
        strokeDasharray="5 4"
        opacity={0.75}
      />

      {/* ---------- caída ---------- */}
      {showFall && fallProfile && (
        <g>
          <path d={toPath(fallProfile)} fill="none" stroke="var(--danger)" strokeWidth={1.8} strokeDasharray="7 4" opacity={0.9} />
          {/* El leash va del anillo sobre la cinta hasta el ARNÉS, o sea la cintura. */}
          <line
            x1={px(personX)}
            y1={py(lineSagNow)}
            x2={px(personX)}
            y2={py(harnessDepth)}
            stroke="var(--danger)"
            strokeWidth={1.3}
          />
          <circle cx={px(personX)} cy={py(harnessDepth)} r={2.2} fill="var(--danger)" />
          <PersonFigure
            x={px(personX)}
            y={py(harnessDepth)}
            size={personSize}
            pose="hanging"
            color="var(--danger)"
          />

          {/* Punto máximo de la caída: hasta dónde llegan los pies. */}
          <line
            x1={px(0)}
            y1={py(feetDepth)}
            x2={px(span)}
            y2={py(feetDepth)}
            stroke="var(--danger)"
            strokeWidth={animating ? 0.7 : 1.1}
            strokeDasharray="3 4"
            opacity={animating ? 0.4 : 0.85}
          />
          <text
            x={px(personX) + personSize * 0.34 + 6}
            y={py(feetDepth) + 3.6}
            fontSize={11}
            fill="var(--danger)"
            fontWeight={650}
          >
            −{feetDepth.toFixed(2)} m
          </text>
        </g>
      )}

      {/* ---------- cinta con la persona parada ---------- */}
      <path d={toPath(stat.loaded.profile)} fill="none" stroke="var(--webbing)" strokeWidth={2.6} strokeLinejoin="round" />

      <line
        x1={px(personX)}
        y1={py(0)}
        x2={px(personX)}
        y2={py(stat.loaded.sagAtLoad)}
        stroke="var(--webbing)"
        strokeWidth={0.9}
        strokeDasharray="2 3"
        opacity={0.8}
      />
      <text
        x={px(personX) - personSize * 0.34 - 5}
        y={(py(0) + py(stat.loaded.sagAtLoad)) / 2 + 3.5}
        fontSize={11}
        textAnchor="end"
        fill="var(--webbing)"
        fontWeight={600}
      >
        SAG {stat.loaded.sagAtLoad.toFixed(2)} m
      </text>

      {geom.showGround && stat.groundClearance > 0 && (
        <>
          <line
            x1={px(span * 0.8)}
            y1={py(stat.loaded.sagMax)}
            x2={px(span * 0.8)}
            y2={groundY}
            stroke="var(--safe)"
            strokeWidth={0.9}
            strokeDasharray="2 3"
          />
          <text
            x={px(span * 0.8) + 7}
            y={(py(stat.loaded.sagMax) + groundY) / 2 + 3.5}
            fontSize={10.5}
            fill="var(--safe)"
            fontWeight={600}
          >
            {stat.groundClearance.toFixed(2)} m
          </text>
        </>
      )}

      <PersonFigure
        x={px(personX)}
        y={py(stat.loaded.sagAtLoad)}
        size={personSize}
        pose="standing"
        color="var(--text)"
        faded={animating}
      />

      <text x={px(0) + 9} y={py(0) - 7} fontSize={10.5} fill="var(--accent)" fontWeight={600}>
        θ {((stat.loaded.thetaAnchor * 180) / Math.PI).toFixed(1)}°
      </text>

      {personClamped && (
        <text x={geom.vbW - PAD_R} y={PAD_T - 10} fontSize={9} textAnchor="end" fill="var(--text-faint)">
          {t('chart.personClamped')}
        </text>
      )}
    </svg>
  );
};
