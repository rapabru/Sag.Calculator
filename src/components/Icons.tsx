import React from 'react';

const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconAlert: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg {...base} width={size} height={size} aria-hidden="true">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconInfo: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg {...base} width={size} height={size} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

export const IconSun: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const IconPlay: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} aria-hidden="true">
    <path d="M6 4l14 8-14 8V4Z" fill="currentColor" />
  </svg>
);

export const IconHelp: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7v.5M12 17h.01" />
  </svg>
);
