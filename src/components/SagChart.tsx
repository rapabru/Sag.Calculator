import React, { useCallback, useMemo, useRef } from 'react';
import type { CalcResult, RigInput } from '../physics';
import { useTranslation } from '../i18n/useTranslation';
import { PAD_B, PAD_L, PAD_R, PAD_T, VB_W, computeChartGeometry } from './chartGeometry';

/**
 * GRÁFICO A ESCALA REAL
 * =====================
 * La escala se calcula acá, en JS, como un único número `scale` en px/metro que
 * se usa para el eje horizontal y para el vertical. Esa es toda la garantía de
 * que el dibujo sea 1:1: no hay dos escalas que puedan desincronizarse.
 *
 * Con eso, el efecto que se ve es el real: una línea corta y floja se dibuja
 * como una V profunda y una larga y tensa como una casi-recta, porque lo que
 * cambia entre ellas es la proporción sag/largo.
 *
 * El slider de exageración multiplica sólo la profundidad, para poder mirar de
 * cerca un sag muy chico. Mientras vale 1, el dibujo no miente.
 */


interface Props {
  input: RigInput;
  result: CalcResult;
  exaggeration: number;
  showFall: boolean;
  /** Profundidad animada de la persona (m); null = mostrar el punto más bajo. */
  animDepth: number | null;
  onPersonPosChange: (pos: number) => void;
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

/** Monigote de tamaño fijo en píxeles, para que no se deforme con la escala. */
const Person: React.FC<{ x: number; y: number; hanging?: boolean; color: string }> = ({
  x,
  y,
  hanging,
  color,
}) => {
  const h = 15;
  return (
    <g
      stroke={color}
      fill="none"
      strokeWidth={1.7}
      strokeLinecap="round"
      transform={`translate(${x} ${y})`}
      aria-hidden="true"
    >
      {hanging ? (
        <>
          <circle cx={0} cy={2} r={2.6} fill={color} stroke="none" />
          <path d={`M0 ${4.6}V${h - 3}`} />
          <path d={`M0 ${h - 3}l-3.4 5M0 ${h - 3}l3.4 5`} />
          <path d={`M0 7l-4.5 -3M0 7l4.5 -3`} />
        </>
      ) : (
        <>
          <circle cx={0} cy={-h + 2.6} r={2.6} fill={color} stroke="none" />
          <path d={`M0 ${-h + 5.2}V${-5}`} />
          <path d={`M0 -5l-3.2 5M0 -5l3.2 5`} />
          <path d={`M0 ${-h + 8}l-4.8 3.2M0 ${-h + 8}l4.8 3.2`} />
        </>
      )}
    </g>
  );
};

export const SagChart: React.FC<Props> = ({
  input,
  result,
  exaggeration,
  showFall,
  animDepth,
  onPersonPosChange,
}) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const stat = result.static;
  const fall = result.fall;
  const span = Math.max(input.span, 0.01);
  const personX = Math.min(Math.max(input.personPos, 0), 1) * span;

  const geom = useMemo(
    () =>
      computeChartGeometry({
        span,
        staticDepth: stat.loaded.sagMax,
        fallDepth: showFall ? fall.personLowestDepth : 0,
        groundDepth: input.anchorHeight,
        exaggeration,
      }),
    [span, stat.loaded.sagMax, showFall, fall.personLowestDepth, input.anchorHeight, exaggeration],
  );

  const { px, py } = geom;

  /** Perfil de la cinta durante la animación, mezclando vacía y pico. */
  const fallProfile = useMemo(() => {
    if (!showFall) return null;
    const empty = stat.empty.profile;
    const peak = fall.peakLineState.profile;
    let mix = 1;
    if (animDepth !== null) {
      const engage = stat.loaded.sagAtLoad - input.harnessHeight + fall.freeFallDistance;
      if (animDepth <= engage) mix = 0;
      else {
        const denom = Math.max(fall.personLowestDepth - engage, 1e-6);
        mix = Math.min(Math.max((animDepth - engage) / denom, 0), 1);
      }
    }
    const pts: Pt[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = (i / 140) * span;
      const a = sampleProfile(empty, x);
      const b = sampleProfile(peak, x);
      pts.push([x, a + mix * (b - a)]);
    }
    return { pts, mix };
  }, [showFall, stat.empty.profile, stat.loaded.sagAtLoad, fall, animDepth, input.harnessHeight, span]);

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
      const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;
      const pos = geom.mFromPx(vbX) / span;
      onPersonPosChange(Math.min(Math.max(pos, 0.02), 0.98));
    },
    [geom, span, onPersonPosChange],
  );

  const personDepth = animDepth ?? fall.personLowestDepth;
  const lineSagNow = fallProfile ? sampleProfile(fallProfile.pts, personX) : 0;
  const groundY = py(geom.groundDepth);
  const bottomY = py(geom.bottom);
  const postBottom = geom.showGround ? groundY : bottomY;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${geom.vbH}`}
      role="img"
      aria-label={t('chart.aria')}
      style={{ cursor: 'ew-resize' }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => dragging.current && handlePointer(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* ---------- suelo ---------- */}
      {geom.showGround ? (
        <>
          <rect
            x={0}
            y={groundY}
            width={VB_W}
            height={Math.max(geom.vbH - PAD_B - groundY, 0)}
            fill="var(--ground)"
            opacity={0.55}
          />
          <line x1={0} y1={groundY} x2={VB_W} y2={groundY} stroke="var(--ground)" strokeWidth={2} />
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
            x2={VB_W - PAD_R}
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

      {/* ---------- eje horizontal: distancia ---------- */}
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

      {/* ---------- cinta vacía ---------- */}
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
          <path d={toPath(fallProfile.pts)} fill="none" stroke="var(--danger)" strokeWidth={1.8} strokeDasharray="7 4" opacity={0.9} />
          <line
            x1={px(personX)}
            y1={py(lineSagNow)}
            x2={px(personX)}
            y2={py(personDepth)}
            stroke="var(--danger)"
            strokeWidth={1.3}
          />
          <Person x={px(personX)} y={py(personDepth)} hanging color="var(--danger)" />
          <line
            x1={px(0)}
            y1={py(personDepth)}
            x2={px(span)}
            y2={py(personDepth)}
            stroke="var(--danger)"
            strokeWidth={0.8}
            strokeDasharray="2 5"
            opacity={0.55}
          />
          <text
            x={px(personX) + 10}
            y={py(personDepth) + 4}
            fontSize={11}
            fill="var(--danger)"
            fontWeight={600}
          >
            −{personDepth.toFixed(2)} m
          </text>
        </g>
      )}

      {/* ---------- cinta con la persona parada ---------- */}
      <path d={toPath(stat.loaded.profile)} fill="none" stroke="var(--webbing)" strokeWidth={2.6} strokeLinejoin="round" />

      {/* cota del sag */}
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
        x={px(personX) - 8}
        y={(py(0) + py(stat.loaded.sagAtLoad)) / 2 + 3.5}
        fontSize={11}
        textAnchor="end"
        fill="var(--webbing)"
        fontWeight={600}
      >
        S {stat.loaded.sagAtLoad.toFixed(2)} m
      </text>

      {/* altura libre bajo la cinta */}
      {geom.showGround && stat.groundClearance > 0 && (
        <>
          <line
            x1={px(span * 0.78)}
            y1={py(stat.loaded.sagMax)}
            x2={px(span * 0.78)}
            y2={groundY}
            stroke="var(--safe)"
            strokeWidth={0.9}
            strokeDasharray="2 3"
          />
          <text
            x={px(span * 0.78) + 7}
            y={(py(stat.loaded.sagMax) + groundY) / 2 + 3.5}
            fontSize={10.5}
            fill="var(--safe)"
            fontWeight={600}
          >
            C {stat.groundClearance.toFixed(2)} m
          </text>
        </>
      )}

      <Person x={px(personX)} y={py(stat.loaded.sagAtLoad)} color="var(--text)" />

      {/* ángulo en el anclaje */}
      <text x={px(0) + 9} y={py(0) - 7} fontSize={10.5} fill="var(--accent)" fontWeight={600}>
        θ {((stat.loaded.thetaAnchor * 180) / Math.PI).toFixed(1)}°
      </text>
    </svg>
  );
};
