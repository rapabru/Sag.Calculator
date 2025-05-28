import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';

export const useTranslation = () => {
  const contextValue = useContext(LanguageContext);
  if (!contextValue) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  // The LanguageContext already provides the current language's translations,
  // the t function with fallback logic, and loading state for all translations.
  // This hook now simply passes through these values from the context.
  // The `isLoadingTranslations` and `translationError` that were previously part of this hook's
  // own state are removed as the hook no longer fetches translations independently.
  // If loading state for initial translations is needed by a component,
  // it should be sourced from or handled within LanguageProvider/LanguageContext.
  return contextValue;
};
