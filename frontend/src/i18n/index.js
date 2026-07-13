import { createContext, createElement, useCallback, useEffect, useMemo, useState } from "react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";

import en from "./locales/en.js";
import { getLocaleResources, normalizeLocaleResource } from "./locale-utils.js";

const STORAGE_KEY = "travelShareLanguage";
export const supportedLanguages = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["pt", "Português"],
  ["nl", "Nederlands"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["zh", "中文"],
  ["ja", "日本語"]
];

export const LANGUAGES = supportedLanguages;

function getStoredLanguage() {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && supportedLanguages.some(([code]) => code === stored)) {
    return stored;
  }
  return "en";
}

function normalizeLanguage(language) {
  if (!language) return "en";
  const code = String(language).toLowerCase();
  return supportedLanguages.some(([supportedCode]) => supportedCode === code) ? code : "en";
}

function persistLanguage(language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, language);
  try {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.localeDirection = language === "ar" ? "rtl" : "ltr";
  } catch (error) {
    // Ignore DOM access issues during SSR or tests.
  }
  window.dispatchEvent(new Event("travelShareLanguageChanged"));
}

const localeLoaders = {
  es: () => import("./locales/es.js"),
  fr: () => import("./locales/fr.js"),
  pt: () => import("./locales/pt.js"),
  nl: () => import("./locales/nl.js"),
  de: () => import("./locales/de.js"),
  it: () => import("./locales/it.js"),
  ar: () => import("./locales/ar.js"),
  hi: () => import("./locales/hi.js"),
  zh: () => import("./locales/zh.js"),
  ja: () => import("./locales/ja.js")
};

const resources = getLocaleResources({ en });
const loadedLanguages = new Set(["en"]);

const i18nInstance = i18next.createInstance();

async function loadLocale(language) {
  const normalizedLanguage = normalizeLanguage(language);
  if (loadedLanguages.has(normalizedLanguage)) return;
  const loader = localeLoaders[normalizedLanguage];
  if (!loader) return;
  const module = await loader();
  const resource = module && typeof module === "object" && "default" in module ? module.default : module;
  i18nInstance.addResourceBundle(
    normalizedLanguage,
    "translation",
    normalizeLocaleResource(resource),
    true,
    true
  );
  loadedLanguages.add(normalizedLanguage);
}

if (!i18nInstance.isInitialized) {
  i18nInstance
    .use(initReactI18next)
    .init({
      resources,
      lng: "en",
      fallbackLng: "en",
      supportedLngs: supportedLanguages.map(([code]) => code),
      interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
      react: { useSuspense: false }
    });
}

export const i18n = i18nInstance;

const LanguageContext = createContext({
  language: getStoredLanguage(),
  setLanguage: () => {},
  t: (key, fallback) => fallback ?? key,
  translate: (key, fallback) => fallback ?? key
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => getStoredLanguage());

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    loadLocale(storedLanguage)
      .then(() => i18n.changeLanguage(storedLanguage))
      .catch(() => i18n.changeLanguage("en"));
    setLanguageState(storedLanguage);
    persistLanguage(storedLanguage || i18n.language || "en");
  }, []);
  useEffect(() => {
    const onLanguageChanged = (nextLanguage) => {
      setLanguageState(nextLanguage || getStoredLanguage());
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    if (normalizedLanguage !== i18n.language) {
      loadLocale(normalizedLanguage)
        .then(() => i18n.changeLanguage(normalizedLanguage))
        .catch(() => i18n.changeLanguage("en"));
    }
    setLanguageState(normalizedLanguage);
    persistLanguage(normalizedLanguage);
  }, []);

  const translate = useCallback((key, fallback, options = {}) => {
    if (!key) return fallback ?? "";
    const resolvedValue = i18n.t(String(key), { defaultValue: fallback ?? "", ...options });
    return resolvedValue ?? fallback ?? "";
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: translate,
    translate
  }), [language, setLanguage, translate]);

  return createElement(
    LanguageContext.Provider,
    { value },
    createElement(I18nextProvider, { i18n }, children)
  );
}

export function useLanguage() {
  const { i18n: activeI18n, t: translateText } = useTranslation();
  const [language, setLanguageState] = useState(() => activeI18n.language || getStoredLanguage());

  useEffect(() => {
    const onLanguageChanged = (nextLanguage) => {
      setLanguageState(nextLanguage || getStoredLanguage());
    };
    activeI18n.on('languageChanged', onLanguageChanged);
    return () => {
      activeI18n.off('languageChanged', onLanguageChanged);
    };
  }, [activeI18n]);

  const setLanguage = useCallback((nextLanguage) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    if (normalizedLanguage !== activeI18n.language) {
      loadLocale(normalizedLanguage)
        .then(() => activeI18n.changeLanguage(normalizedLanguage))
        .catch(() => activeI18n.changeLanguage("en"));
    }
    setLanguageState(normalizedLanguage);
    persistLanguage(normalizedLanguage);
  }, [activeI18n]);

  const t = useCallback((key, fallback, options = {}) => {
    if (!key) return fallback ?? "";
    const resolvedValue = translateText(String(key), { defaultValue: fallback ?? "", ...options });
    return resolvedValue ?? fallback ?? "";
  }, [translateText]);

  return useMemo(() => ({
    language,
    setLanguage,
    t,
    translate: t
  }), [language, setLanguage, t]);
}

export function getLanguage() {
  return i18n.language || getStoredLanguage();
}

export function setLanguage(nextLanguage) {
  const normalizedLanguage = normalizeLanguage(nextLanguage);
  persistLanguage(normalizedLanguage);
  if (normalizedLanguage !== i18n.language) {
    loadLocale(normalizedLanguage)
      .then(() => i18n.changeLanguage(normalizedLanguage))
      .catch(() => i18n.changeLanguage("en"));
  }
  return normalizedLanguage;
}

export function translate(key, fallback, options = {}) {
  return i18n.t(String(key), { defaultValue: fallback ?? "", ...options });
}

export function t(key, fallback, options = {}) {
  return translate(key, fallback, options);
}

export const useI18n = useLanguage;

export function useCurrentLanguage() {
  return useLanguage();
}

export { LanguageContext };
