
import React, { createContext, useState, useEffect, useCallback } from 'react';

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'zh-CN' | 'ja' | 'pt' | 'ru' | 'ar' | 'hi';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  translations: Record<string, string>; // Translations for the current language
  t: (key: string, replacements?: Record<string, string | number>) => string;
  availableLanguages: Record<LanguageCode, string>;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// This list drives fetching and the language selector
const availableLanguagesList: Record<LanguageCode, string> = {
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'zh-CN': '中文 (简体)',
  'ja': '日本語',
  'pt': 'Português',
  'ru': 'Русский',
  'ar': 'العربية',
  'hi': 'हिन्दी'
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    // More robust check if browserLang is a valid LanguageCode
    if (availableLanguagesList.hasOwnProperty(browserLang)) {
        return browserLang as LanguageCode;
    }
    // Check for more specific codes like 'zh-cn'
    if (browserLang === 'zh' && availableLanguagesList.hasOwnProperty('zh-CN')) {
        return 'zh-CN';
    }
    return 'en'; // Default language
  });

  const [allLoadedTranslations, setAllLoadedTranslations] = useState<Record<LanguageCode, Record<string, string>> | null>(null);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      setIsLoadingTranslations(true);
      try {
        const loaded: Partial<Record<LanguageCode, Record<string, string>>> = {};
        const languageCodesToLoad = Object.keys(availableLanguagesList) as LanguageCode[];

        const fetchPromises = languageCodesToLoad.map(async (langCode) => {
          try {
            // Assuming locales directory is at the root of the served application
            const response = await fetch(`/locales/${langCode}.json`);
            if (!response.ok) {
              console.error(`Failed to load ${langCode}.json: ${response.statusText}`);
              return { langCode, data: null }; // Indicate failure for this language
            }
            const data = await response.json();
            return { langCode, data };
          } catch (error) {
            console.error(`Error fetching ${langCode}.json:`, error);
            return { langCode, data: null }; // Indicate failure for this language
          }
        });

        const results = await Promise.all(fetchPromises);

        results.forEach(result => {
          if (result.data) {
            loaded[result.langCode] = result.data;
          }
        });
        
        // Ensure English is loaded as a fallback if possible
        if (!loaded.en) {
            console.warn("English (en.json) translations failed to load. UI might show keys.");
        }

        setAllLoadedTranslations(loaded as Record<LanguageCode, Record<string, string>>);
      } catch (error) {
        // This catch might be for Promise.all itself, though individual errors are handled above
        console.error("A critical error occurred during translation loading:", error);
        // Set to empty or minimal fallback if all else fails
        setAllLoadedTranslations({ en: {} } as Record<LanguageCode, Record<string, string>>); 
      } finally {
        setIsLoadingTranslations(false);
      }
    };

    loadTranslations();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (availableLanguagesList.hasOwnProperty(lang)) {
        setLanguageState(lang);
    } else {
        console.warn(`Attempted to set unknown language: ${lang}`);
    }
  }, []);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    if (isLoadingTranslations || !allLoadedTranslations) {
      return key; // Return key if translations are not ready
    }

    let translation = allLoadedTranslations[language]?.[key] || allLoadedTranslations['en']?.[key] || key;
    
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(replacements[placeholder]));
      });
    }
    return translation;
  }, [language, allLoadedTranslations, isLoadingTranslations]);

  if (isLoadingTranslations) {
    // Render nothing or a global loading spinner while translations are essential
    return null; 
  }
  
  const currentTranslations = allLoadedTranslations?.[language] || allLoadedTranslations?.['en'] || {};

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translations: currentTranslations, t, availableLanguages: availableLanguagesList }}>
      {children}
    </LanguageContext.Provider>
  );
};
