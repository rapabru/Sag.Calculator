import React from 'react';
import type { CalcResult, RigInput } from '../physics';
import { useTranslation } from '../i18n/useTranslation';
import { ResultTile } from './ResultTile';

const kN = (n: number) => (n / 1000).toFixed(2);

export const StaticResults: React.FC<{ input: RigInput; result: CalcResult }> = ({ input, result }) => {
  const { t } = useTranslation();
  const s = result.static;
  const touching = s.groundClearance <= 0;

  return (
    <div className="tiles">
      <ResultTile
        hero
        tone="webbing"
        label={t('res.sag')}
        value={s.loaded.sagMax.toFixed(2)}
        unit="m"
        sub={t('res.sag.sub')}
      />
      <ResultTile
        hero
        tone={touching ? 'danger' : 'safe'}
        label={t('res.clearance')}
        value={touching ? '0' : s.groundClearance.toFixed(2)}
        unit="m"
        sub={touching ? t('res.clearance.contact') : undefined}
      />
      <ResultTile
        label={t('res.ratio')}
        value={s.sagRatioPct.toFixed(1)}
        unit="%"
        sub={t('res.ratio.sub')}
      />
      <ResultTile
        label={t('res.theta')}
        value={((s.loaded.thetaAnchor * 180) / Math.PI).toFixed(1)}
        unit="°"
      />
      <ResultTile
        label={t('res.tension')}
        value={kN(s.loaded.H)}
        unit="kN"
        sub={t('res.tension.sub', { pre: (input.pretensionN / 1000).toFixed(1) })}
      />
      <ResultTile label={t('res.anchorLoad')} value={kN(s.loaded.anchorTensionN)} unit="kN" />
      <ResultTile
        tone={s.overElongated ? 'danger' : 'plain'}
        label={t('res.strain')}
        value={(s.loaded.strain * 100).toFixed(2)}
        unit="%"
        sub={t('res.strain.limit', { limit: input.elongationLimitPct })}
      />
    </div>
  );
};

export const FallResults: React.FC<{ input: RigInput; result: CalcResult }> = ({ input, result }) => {
  const { t } = useTranslation();
  const f = result.fall;

  return (
    <div className="tiles">
      {/* Lo que llega al suelo son los pies, no el punto del arnés. */}
      <ResultTile
        hero
        tone="danger"
        label={t('res.lowest')}
        value={f.lowestBodyPoint.toFixed(2)}
        unit="m"
        sub={t('res.lowest.sub', { harness: f.personLowestDepth.toFixed(2) })}
      />
      <ResultTile
        hero
        tone={f.hitsGround ? 'danger' : 'safe'}
        label={t('res.fallClearance')}
        value={f.bodyGroundClearance.toFixed(2)}
        unit="m"
        sub={f.hitsGround ? t('res.fallClearance.impact') : t('res.fallClearance.sub')}
      />
      <ResultTile label={t('res.totalDrop')} value={f.totalDrop.toFixed(2)} unit="m" sub={t('res.totalDrop.sub')} />
      <ResultTile
        label={t('res.dynamicSag')}
        value={f.dynamicSag.toFixed(2)}
        unit="m"
        sub={t('res.dynamicSag.sub', { extra: f.extraSag.toFixed(2) })}
      />
      <ResultTile
        tone="webbing"
        label={t('res.peakForce')}
        value={kN(f.peakForceN)}
        unit="kN"
        sub={t('res.peakForce.sub', { g: f.peakForceBodyWeights.toFixed(1) })}
      />
      <ResultTile
        tone={f.peakAnchorTensionN > 25000 ? 'danger' : 'plain'}
        label={t('res.peakAnchor')}
        value={kN(f.peakAnchorTensionN)}
        unit="kN"
      />
      <ResultTile
        label={t('res.freeFall')}
        value={f.freeFallDistance.toFixed(2)}
        unit="m"
        sub={t('res.freeFall.sub', { ff: f.fallFactor.toFixed(2) })}
      />
      <ResultTile
        tone={f.overElongated ? 'danger' : 'plain'}
        label={t('res.strain')}
        value={(f.dynamicStrain * 100).toFixed(2)}
        unit="%"
        sub={t('res.strain.limit', { limit: input.elongationLimitPct })}
      />
    </div>
  );
};
