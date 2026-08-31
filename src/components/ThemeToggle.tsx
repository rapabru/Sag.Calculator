import React, { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './Icons';

type Theme = 'dark' | 'light';
const KEY = 'sagcalc.theme';

function initial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* sin almacenamiento: cae al esquema del sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const ThemeToggle: React.FC<{ title: string }> = ({ title }) => {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* preferencia sólo para esta sesión */
    }
  }, [theme]);

  return (
    <button
      className="icon-btn"
      title={title}
      aria-label={title}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
};
