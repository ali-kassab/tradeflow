import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export { resources };

export const LANGUAGES = ['ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'tf.lang';

function storedLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ar' || v === 'en') return v;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'ar';
}

/** Keeps <html lang dir> in sync so the browser, shadcn and logical CSS all flip together. */
function applyDocumentLanguage(lng: string) {
  const el = document.documentElement;
  el.lang = lng;
  el.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Ignore: persistence is a convenience only.
  }
});

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage(),
  fallbackLng: 'ar',
  defaultNS: 'common',
  ns: Object.keys(resources.ar),
  interpolation: { escapeValue: false },
  returnNull: false,
});
applyDocumentLanguage(i18n.language);

export default i18n;
