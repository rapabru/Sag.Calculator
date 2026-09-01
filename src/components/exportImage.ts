import type { CalcResult, RigInput } from '../physics';

/**
 * EXPORTAR A IMAGEN
 * =================
 * El gráfico usa variables CSS (`var(--webbing)`, `var(--danger)`, …) en los
 * atributos de presentación del SVG. Dentro del documento el navegador las
 * resuelve, pero un SVG serializado y metido en un <img> vive aislado: ahí las
 * variables no existen y todo sale en negro. Por eso, antes de serializar, se
 * sustituye cada `var(--x)` por el color literal leído del documento.
 */

export const TOKENS = [
  'bg', 'surface', 'surface-2', 'border', 'border-strong',
  'text', 'text-dim', 'text-faint', 'webbing', 'safe', 'danger', 'accent', 'ground',
];

function palette(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const name of TOKENS) out[name] = cs.getPropertyValue(`--${name}`).trim() || '#888';
  return out;
}

export function resolveVars(svg: string, colors: Record<string, string>): string {
  return svg.replace(/var\(--([a-z0-9-]+)\)/gi, (match, name: string) => colors[name] ?? match);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ExportOptions {
  detailed: boolean;
  includeChart: boolean;
  input: RigInput;
  result: CalcResult;
  t: (key: string, r?: Record<string, string | number>) => string;
  title: string;
}

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const W = 1000;

/** Filas de datos del modo ampliado: etiqueta, valor. */
function detailRows(o: ExportOptions): Array<[string, string]> {
  const { input: i, result: r, t } = o;
  const kN = (n: number) => (n / 1000).toFixed(2) + ' kN';
  return [
    [t('field.span'), `${i.span} m`],
    [t('field.pretension'), kN(i.pretensionN)],
    [t('field.mass'), `${i.personMassKg} kg`],
    [t('field.personHeight'), `${i.personHeight.toFixed(2)} m`],
    [t('field.anchorHeight'), `${i.anchorHeight} m`],
    [t('field.mainWeight'), `${i.mainWeightGm} g/m`],
    [t('field.elongation'), `${i.webbingElongationPct} % @ 10 kN`],
    [t('field.leashLength'), `${i.leashLength.toFixed(2)} m`],
    ['—', '—'],
    [t('res.sag'), `${r.static.loaded.sagMax.toFixed(2)} m`],
    [t('res.ratio'), `${r.static.sagRatioPct.toFixed(1)} %`],
    [t('res.theta'), `${((r.static.loaded.thetaAnchor * 180) / Math.PI).toFixed(1)}°`],
    [t('res.tension'), kN(r.static.loaded.H)],
    [t('res.clearance'), `${r.static.groundClearance.toFixed(2)} m`],
    ['—', '—'],
    [t('res.lowest'), `${r.fall.lowestBodyPoint.toFixed(2)} m`],
    [t('res.fallClearance'), `${r.fall.bodyGroundClearance.toFixed(2)} m`],
    [t('res.totalDrop'), `${r.fall.totalDrop.toFixed(2)} m`],
    [t('res.peakForce'), `${kN(r.fall.peakForceN)} (${r.fall.peakForceBodyWeights.toFixed(1)}×)`],
    [t('res.peakAnchor'), kN(r.fall.peakAnchorTensionN)],
  ];
}

/** Compone el SVG final: cabecera, el gráfico si se pide, y los datos si se piden. */
export function buildExportSvg(chart: SVGSVGElement | null, o: ExportOptions): string {
  const colors = palette();
  const withChart = o.includeChart && !!chart;
  const vb = (chart?.getAttribute('viewBox') ?? '0 0 1000 400').split(/\s+/).map(Number);
  const chartH = withChart ? vb[3] : 0;

  const headerH = 54;
  const rows = o.detailed ? detailRows(o) : [];
  const rowH = 19;
  const cols = 2;
  const perCol = Math.ceil(rows.length / cols);
  const dataH = o.detailed ? perCol * rowH + 26 : 0;
  const footerH = o.detailed ? 46 : 26;
  const H = headerH + chartH + dataH + footerH;

  const inner = withChart && chart ? resolveVars(chart.innerHTML, colors) : '';
  const date = new Date().toLocaleDateString();

  let body = '';
  if (o.detailed) {
    const top = headerH + chartH + 20;
    rows.forEach((row, idx) => {
      const col = Math.floor(idx / perCol);
      const y = top + (idx % perCol) * rowH;
      const x = 54 + col * 470;
      if (row[0] === '—') {
        body += `<line x1="${x}" y1="${y - 6}" x2="${x + 420}" y2="${y - 6}" stroke="${colors.border}" stroke-width="1"/>`;
      } else {
        body += `<text x="${x}" y="${y}" font-size="11.5" fill="${colors['text-dim']}">${esc(row[0])}</text>`;
        body += `<text x="${x + 420}" y="${y}" font-size="11.5" text-anchor="end" fill="${colors.text}" font-weight="600">${esc(row[1])}</text>`;
      }
    });
    body += `<text x="54" y="${H - 24}" font-size="9.5" fill="${colors['text-faint']}">${esc(o.t('banner.model').slice(0, 150))}…</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="${colors.surface}"/>
<text x="54" y="30" font-size="16" font-weight="700" letter-spacing="2" fill="${colors.text}">SAG<tspan fill="${colors.webbing}">·</tspan>CALC</text>
<text x="54" y="45" font-size="10.5" fill="${colors['text-dim']}">${esc(o.title)}</text>
<text x="${W - 54}" y="30" font-size="10.5" text-anchor="end" fill="${colors['text-faint']}">${esc(date)}</text>
<line x1="0" y1="${headerH - 8}" x2="${W}" y2="${headerH - 8}" stroke="${colors.border}" stroke-width="1"/>
${withChart ? `<g transform="translate(0 ${headerH})">${inner}</g>` : ''}
${body}
<text x="${W - 54}" y="${H - 10}" font-size="9" text-anchor="end" fill="${colors['text-faint']}">sag calculator</text>
</svg>`;
}

/** Rasteriza el SVG compuesto. `type` es 'image/png' o 'image/jpeg'. */
export async function renderToBlob(svgString: string, type: string): Promise<Blob> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo rasterizar el SVG'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width || 2000;
  canvas.height = img.height || 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin contexto 2D');
  // El JPG no tiene transparencia: sin fondo explícito sale con bordes negros.
  if (type === 'image/jpeg') {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob vacío'))), type, 0.92);
  });
}

export function fileNameFor(input: RigInput, ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `sag-${input.span}m-${(input.pretensionN / 1000).toFixed(1)}kN-${input.personMassKg}kg-${d}.${ext}`;
}
