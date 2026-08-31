import React from 'react';

interface Props {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: 'plain' | 'webbing' | 'safe' | 'danger';
  hero?: boolean;
}

export const ResultTile: React.FC<Props> = ({ label, value, unit, sub, tone = 'plain', hero }) => (
  <div className={`tile${hero ? ' hero' : ''}${tone !== 'plain' ? ` is-${tone}` : ''}`}>
    <div className="tile-label">{label}</div>
    <div className="tile-value">
      {value}
      {unit && <span className="unit">{unit}</span>}
    </div>
    {sub && <div className="tile-sub">{sub}</div>}
  </div>
);
