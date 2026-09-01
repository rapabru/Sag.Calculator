import React, { useCallback, useState } from 'react';
import type { CalcResult, RigInput } from '../physics';
import { useTranslation } from '../i18n/useTranslation';
import { buildExportSvg, fileNameFor, renderToBlob } from './exportImage';

interface Props {
  getChart: () => SVGSVGElement | null;
  input: RigInput;
  result: CalcResult;
  /** Marca el documento para que la hoja de impresión sepa qué mostrar. */
  onModeChange: (opts: { detailed: boolean; includeChart: boolean }) => void;
  /** 'up' para la barra del gráfico, 'down' para la barra superior. */
  placement?: 'up' | 'down';
}

type Status = 'idle' | 'working' | 'done' | 'error';

export const ExportPanel: React.FC<Props> = ({ getChart, input, result, onModeChange, placement = 'up' }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detailed, setDetailed] = useState(true);
  const [includeChart, setIncludeChart] = useState(true);
  const [status, setStatus] = useState<Status>('idle');

  const setDetail = useCallback(
    (v: boolean) => {
      // Sin gráfico y sin datos no queda nada que exportar.
      const chart = v ? includeChart : true;
      setDetailed(v);
      setIncludeChart(chart);
      onModeChange({ detailed: v, includeChart: chart });
    },
    [includeChart, onModeChange],
  );

  const setChart = useCallback(
    (v: boolean) => {
      const detail = v ? detailed : true;
      setIncludeChart(v);
      setDetailed(detail);
      onModeChange({ detailed: detail, includeChart: v });
    },
    [detailed, onModeChange],
  );

  const makeBlob = useCallback(
    async (type: string) => {
      const chart = getChart();
      if (!chart && includeChart) throw new Error('sin gráfico');
      const svg = buildExportSvg(chart, {
        detailed,
        includeChart,
        input,
        result,
        t,
        title: t('app.subtitle'),
      });
      return renderToBlob(svg, type);
    },
    [getChart, detailed, includeChart, input, result, t],
  );

  const saveImage = useCallback(
    async (ext: 'png' | 'jpg') => {
      setStatus('working');
      try {
        const blob = await makeBlob(ext === 'png' ? 'image/png' : 'image/jpeg');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileNameFor(input, ext);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus('done');
        window.setTimeout(() => setStatus('idle'), 1800);
      } catch {
        setStatus('error');
        window.setTimeout(() => setStatus('idle'), 2500);
      }
    },
    [makeBlob, input],
  );

  const shareImage = useCallback(async () => {
    setStatus('working');
    try {
      const blob = await makeBlob('image/jpeg');
      const file = new File([blob], fileNameFor(input, 'jpg'), { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SAG Calculator' });
        setStatus('idle');
      } else {
        await saveImage('jpg');
      }
    } catch {
      setStatus('idle');
    }
  }, [makeBlob, input, saveImage]);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    <div className="export-wrap no-print">
      <button className="btn no-print" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {t('export.button')}
      </button>

      {open && (
        <div className={`export-pop export-pop--${placement}`} role="dialog" aria-label={t('export.button')}>
          <div className="export-group">
            <span className="export-label">{t('export.detail')}</span>
            <div className="export-seg" role="radiogroup" aria-label={t('export.detail')}>
              <button className="chip" role="radio" aria-checked={!detailed} aria-pressed={!detailed} onClick={() => setDetail(false)}>
                {t('export.compact')}
              </button>
              <button className="chip" role="radio" aria-checked={detailed} aria-pressed={detailed} onClick={() => setDetail(true)}>
                {t('export.full')}
              </button>
            </div>
          </div>

          <div className="export-group">
            <span className="export-label">{t('export.chart')}</span>
            <div className="export-seg" role="radiogroup" aria-label={t('export.chart')}>
              <button className="chip" role="radio" aria-checked={includeChart} aria-pressed={includeChart} onClick={() => setChart(true)}>
                {t('export.withChart')}
              </button>
              <button className="chip" role="radio" aria-checked={!includeChart} aria-pressed={!includeChart} onClick={() => setChart(false)}>
                {t('export.withoutChart')}
              </button>
            </div>
          </div>

          <div className="export-actions">
            <button className="btn" onClick={() => saveImage('jpg')}>JPG</button>
            <button className="btn" onClick={() => saveImage('png')}>PNG</button>
            <button className="btn" onClick={() => window.print()}>{t('export.pdf')}</button>
            {canShare && (
              <button className="btn primary" onClick={shareImage}>{t('export.share')}</button>
            )}
          </div>

          <p className="export-note">
            {status === 'working' && t('export.working')}
            {status === 'done' && t('export.done')}
            {status === 'error' && t('export.error')}
            {status === 'idle' && t('export.hint')}
          </p>
        </div>
      )}
    </div>
  );
};
