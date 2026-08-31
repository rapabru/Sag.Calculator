import React from 'react';
import { AVAILABLE_LANGUAGES } from '../i18n/LanguageContext';
import { useTranslation } from '../i18n/useTranslation';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();
  return (
    <select
      value={language}
      aria-label={t('lang.label')}
      onChange={(e) => setLanguage(e.target.value)}
    >
      {Object.entries(AVAILABLE_LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
};
