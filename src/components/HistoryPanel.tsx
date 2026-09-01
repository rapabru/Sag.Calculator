import React from 'react';
import type { RigInput } from '../physics';
import type { HistoryEntry } from '../history/storage';
import { useTranslation } from '../i18n/useTranslation';

interface Props {
  entries: HistoryEntry[];
  onRestore: (input: RigInput) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function when(ts: number, locale: string): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export const HistoryPanel: React.FC<Props> = ({ entries, onRestore, onDelete, onClear }) => {
  const { t, language } = useTranslation();

  return (
    <section className="panel" data-tour="history">
      <div className="panel-head">
        <h2>{t('history.title')}</h2>
        {entries.length > 0 && (
          <button className="mini-btn no-print" onClick={onClear}>
            {t('history.clear')}
          </button>
        )}
      </div>
      <div className="panel-body tight">
        {entries.length === 0 ? (
          <p className="field-note" style={{ margin: '4px 0' }}>{t('history.empty')}</p>
        ) : (
          <ul className="history-list">
            {entries.map((e) => (
              <li key={e.id} className={e.summary.hitsGround ? 'is-danger' : undefined}>
                <button className="history-row" onClick={() => onRestore(e.input)}>
                  <span className="history-when mono">{when(e.savedAt, language)}</span>
                  <span className="history-rig mono">
                    {e.summary.span} m · {e.summary.pretensionKN.toFixed(1)} kN · {e.summary.massKg} kg
                  </span>
                  <span className="history-out mono">
                    {t('history.sagShort')} {e.summary.sag.toFixed(2)} m
                    {e.summary.peakForceKN !== null && ` · ${e.summary.peakForceKN.toFixed(1)} kN`}
                  </span>
                </button>
                <button
                  className="chip-x no-print"
                  aria-label={t('history.delete')}
                  onClick={() => onDelete(e.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
