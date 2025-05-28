import { useContext, useState, useEffect, useCallback } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import type { LanguageCode } from '../context/LanguageContext';

export const useTranslation = () => {
  const contextValue = useContext(LanguageContext);
  if (!contextValue) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  const {
    language, // The current language code, from context
    setLanguage,
    availableLanguages,
    t: contextT, // The t function from context (uses LanguageProvider's allLoadedTranslations)
    translations: contextTranslations, // The translations object from context
  } = contextValue;

  const [hookState, setHookState] = useState<{
    translations: Record<string, string> | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    translations: null, // Initially, we don't have translations fetched by this hook
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // This effect will run if `language` changes.
    // It will fetch translations for the current language using the user's specified lines.
    if (!language) return;

    let isActive = true; // To prevent state updates on unmounted component
    setHookState(prev => ({ ...prev, translations: null, isLoading: true, error: null }));

    const fetchTranslationsForHook = async () => {
      try {
        // User's requested code:
        const response = await fetch(`/locales/${language}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch /locales/${language}.json: ${response.status}`);
        }
        const translationsData = await response.json();
        if (isActive) {
          setHookState({ translations: translationsData, isLoading: false, error: null });
        }
      } catch (err) {
        console.error(`useTranslation hook failed to load ${language}.json:`, err);
        if (isActive) {
          // Keep previous translations (if any from a prior successful fetch) or set to null
          setHookState(prev => ({ ...prev, translations: null, isLoading: false, error: err as Error }));
        }
      }
    };

    fetchTranslationsForHook();

    return () => {
      isActive = false;
    };
  }, [language]); // Dependency: language from context

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let text: string | undefined;

    // Prioritize translations fetched by this hook if available and not loading/error
    if (hookState.translations && !hookState.isLoading && !hookState.error) {
      text = hookState.translations[key];
    }

    // If key not found in hook's translations, or hook is loading/error,
    // fall back to the context's t function.
    // The context's t function already handles its own loading state and fallbacks (e.g., to English).
    if (text === undefined) {
      return contextT(key, replacements);
    }

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        text = (text as string).replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(replacements[placeholder]));
      });
    }
    return text as string;
  }, [hookState.translations, hookState.isLoading, hookState.error, contextT, language]);


  // Determine which translations object to return.
  // If hook has successfully loaded and has no error, use its translations.
  // Otherwise, fall back to context's translations.
  const finalTranslations = (hookState.translations && !hookState.isLoading && !hookState.error)
    ? hookState.translations
    : contextTranslations;

  return {
    language,
    setLanguage,
    translations: finalTranslations,
    t, // The new t function that prefers hook's translations
    availableLanguages,
    isLoadingTranslations: hookState.isLoading, // Expose loading state of the hook's fetch
    translationError: hookState.error, // Expose error state of the hook's fetch
  };
};
