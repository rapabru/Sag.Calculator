
import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import type { LanguageCode } from '../context/LanguageContext';

export const useTranslation = () => {
  const contextValue = useContext(LanguageContext);
  if (!contextValue) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  // Directly use values from context.
  // LanguageProvider is responsible for loading all translations and providing
  // the correct 'translations' object (for the current language with fallbacks)
  // and the 't' function that operates on this data.
  const {
    language,
    setLanguage,
    translations, // This is allLoadedTranslations[currentLanguage] or fallback from LanguageContext
    t,            // This is the 't' function from LanguageContext
    availableLanguages,
  } = contextValue;

  // The LanguageProvider already handles the global loading state by returning null
  // while its initial translation load is in progress. If more granular loading
  // or error states are needed at the component level from this hook,
  // they would need to be exposed by LanguageContext.
  // For now, the existing behavior of LanguageProvider covers the main loading phase.

  return {
    language,
    setLanguage,
    translations,
    t,
    availableLanguages,
  };
};
