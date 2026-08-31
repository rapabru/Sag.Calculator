import React, { useCallback, useState } from 'react';
import type { CalcResult, RigInput } from '../physics';
import { useTranslation } from '../i18n/useTranslation';
import { buildExportSvg, fileNameFor, renderToBlob } from './exportImage';

interface Props {
  getChart: () => SVGSVGElement | null;
  input: RigInput;
  result: CalcResult;
  /** Marca el documento para que la hoja de impresión sepa cuánto mostrar. */
  onDetailedChange: (detailed: boolean) => void;
}

type Status = 'idle' | 'working' | 'done' | 'error';

export const ExportPanel: React.FC<Props> = ({ getChart, input, result, onDetailedChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detailed, setDetailed] = useState(true);
  const [status, setStatus] = useState<Status>('idle');

  const setDetail = useCallback(
    (v: boolean) => {
      setDetailed(v);
      onDetailedChange(v);
    },
    [onDetailedChange],
  );

  const makeBlob = useCallback(
    async (type: string) => {
      const chart = getChart();
      if (!chart) throw new Error('sin gráfico');
      const svg = buildExportSvg(chart, {
        detailed,
        input,
        result,
        t,
        title: t('app.subtitle'),
      });
      return renderToBlob(svg, type);
    },
    [getChart, detailed, input, result, t],
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
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {t('export.button')}
      </button>

      {open && (
        <div className="export-pop" role="dialog" aria-label={t('export.button')}>
          <div className="export-seg" role="radiogroup" aria-label={t('export.detail')}>
            <button
              className="chip"
              role="radio"
              aria-checked={!detailed}
              aria-pressed={!detailed}
              onClick={() => setDetail(false)}
            >
              {t('export.compact')}
            </button>
            <button
              className="chip"
              role="radio"
              aria-checked={detailed}
              aria-pressed={detailed}
              onClick={() => setDetail(true)}
            >
              {t('export.full')}
            </button>
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
