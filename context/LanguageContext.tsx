
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
    if (availableLanguagesList.hasOwnProperty(browserLang)) {
        return browserLang as LanguageCode;
    }
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
        const cacheBuster = `v=${new Date().getTime()}`; // Cache-busting query parameter

        const fetchPromises = languageCodesToLoad.map(async (langCode) => {
          // Use absolute path from server root
          const localeFileUrl = `/locales/${langCode}.json?${cacheBuster}`; 
          try {
            const response = await fetch(localeFileUrl);
            
            if (!response.ok) {
              console.error(`Failed to load ${langCode}.json from ${localeFileUrl}: ${response.status} ${response.statusText}`);
              return { langCode, data: null }; 
            }
            const data = await response.json();
            return { langCode, data };
          } catch (error) {
            console.error(`Error fetching or parsing ${langCode}.json from ${localeFileUrl}:`, error);
            return { langCode, data: null }; 
          }
        });

        const results = await Promise.all(fetchPromises);

        results.forEach(result => {
          if (result.data) {
            loaded[result.langCode] = result.data;
          }
        });
        
        if (!loaded.en) {
            console.warn("English (en.json) translations failed to load. UI might show keys.");
        }

        setAllLoadedTranslations(loaded as Record<LanguageCode, Record<string, string>>);
      } catch (error) {
        console.error("A critical error occurred during translation loading:", error);
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
      return key; 
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
    return null; 
  }
  
  const currentTranslations = allLoadedTranslations?.[language] || allLoadedTranslations?.['en'] || {};

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translations: currentTranslations, t, availableLanguages: availableLanguagesList }}>
      {children}
    </LanguageContext.Provider>
  );
};
