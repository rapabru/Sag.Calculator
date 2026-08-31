import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Los locales se importan estáticamente, uno por uno. La versión anterior de la
 * app hacía fetch de los diez JSON al arrancar (diez requests, con cache-buster),
 * que es lo que causaba los problemas de rutas en el deploy. Acá quedan dentro
 * del bundle: cero requests y cero rutas que puedan romperse.
 */
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import zhCN from './locales/zh-CN.json';

const bundles: Record<string, Record<string, string>> = {
  es,
  en,
  fr,
  de,
  pt,
  hi,
  'zh-CN': zhCN,
  ja,
  ru,
  ar,
};

export const AVAILABLE_LANGUAGES: Record<string, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  hi: 'हिन्दी',
  'zh-CN': '中文',
  ja: '日本語',
  ru: 'Русский',
  ar: 'العربية',
};

const RTL = new Set(['ar']);
const STORAGE_KEY = 'sagcalc.lang';

export interface LanguageContextValue {
  language: string;
  setLanguage: (code: string) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && bundles[stored]) return stored;
  } catch {
    /* almacenamiento no disponible (modo privado): seguimos con el navegador */
  }
  const nav = navigator.language ?? 'es';
  if (bundles[nav]) return nav;
  const short = nav.split('-')[0].toLowerCase();
  if (short === 'zh') return 'zh-CN';
  return bundles[short] ? short : 'es';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL.has(language) ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((code: string) => {
    if (!bundles[code]) return;
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* si no se puede persistir, el idioma vale para esta sesión */
    }
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) => {
      const raw = bundles[language]?.[key] ?? bundles.en?.[key] ?? bundles.es?.[key] ?? key;
      if (!replacements) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in replacements ? String(replacements[name]) : match,
      );
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
