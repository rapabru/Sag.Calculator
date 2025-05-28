import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import type { LanguageCode } from '../context/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t, availableLanguages } = useTranslation();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value as LanguageCode);
  };

  return (
    <div className="relative">
      <label htmlFor="language-select" className="sr-only">{t('langSwitcher.label')}</label>
      <select
        id="language-select"
        value={language}
        onChange={handleChange}
        className="block w-full appearance-none bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 px-3 pe-8 rounded-md leading-tight focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm"
        aria-label={t('langSwitcher.label')}
      >
        {(Object.keys(availableLanguages) as LanguageCode[]).map((langCode) => (
          <option key={langCode} value={langCode}>
            {availableLanguages[langCode]}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-2 text-slate-700 dark:text-slate-200">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M5.516 7.548c.436-.446 1.043-.48 1.576 0L10 10.405l2.908-2.857c.533-.48 1.14-.446 1.576 0 .436.445.408 1.197 0 1.615l-3.69 3.648c-.269.272-.623.408-.98.408s-.711-.136-.98-.408l-3.69-3.648c-.408-.418-.436-1.17 0-1.615z"/>
        </svg>
      </div>
    </div>
  );
};