import React, { useMemo } from 'react';
import { DEFAULT_INPUT, solveStatic } from '../physics';
import { useTranslation } from '../i18n/useTranslation';

/** Los textos vienen de los locales propios de la app, no de entrada del usuario. */
const html = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });

export const PhysicsNotes: React.FC = () => {
  const { t } = useTranslation();

  // La tabla se calcula con el mismo solver que el resto de la app, así los
  // números del texto no pueden quedar desactualizados respecto del modelo.
  const rows = useMemo(() => {
    const cases: Array<[string, number, number]> = [
      ['20 m @ 1,5 kN', 20, 1500],
      ['70 m @ 3 kN', 70, 3000],
      ['200 m @ 12 kN', 200, 12000],
    ];
    return cases.map(([label, span, pretensionN]) => {
      const r = solveStatic({ ...DEFAULT_INPUT, span, pretensionN });
      return {
        label,
        sag: r.loaded.sagMax.toFixed(2),
        ratio: r.sagRatioPct.toFixed(1),
        theta: ((r.loaded.thetaAnchor * 180) / Math.PI).toFixed(1),
      };
    });
  }, []);

  return (
    <details className="notes panel">
      <summary>{t('notes.title')}</summary>
      <div className="prose">
        <h3>{t('notes.h1')}</h3>
        <p {...html(t('notes.p1'))} />

        <h3>{t('notes.h2')}</h3>
        <p {...html(t('notes.p2'))} />
        <span className="eq">{t('notes.eq2')}</span>
        <p {...html(t('notes.p2b'))} />

        <h3>{t('notes.h3')}</h3>
        <p {...html(t('notes.p3'))} />
        <p {...html(t('notes.p3b'))} />
        <table>
          <thead>
            <tr>
              <th>{t('notes.th.case')}</th>
              <th>{t('notes.th.sag')}</th>
              <th>{t('notes.th.ratio')}</th>
              <th>{t('notes.th.theta')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{r.sag} m</td>
                <td>{r.ratio} %</td>
                <td>{r.theta}°</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p {...html(t('notes.p3c'))} />

        <h3>{t('notes.h4')}</h3>
        <p {...html(t('notes.p4'))} />
        <span className="eq">{t('notes.eq4')}</span>
        <p {...html(t('notes.p4b'))} />
        <p {...html(t('notes.p4c'))} />

        <h3>{t('notes.h5')}</h3>
        <p {...html(t('notes.p5'))} />
      </div>
    </details>
  );
};
