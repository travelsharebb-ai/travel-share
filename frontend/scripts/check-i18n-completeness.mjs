import path from 'node:path';
import { fileURLToPath } from 'node:url';

import en from '../src/i18n/locales/en.js';
import es from '../src/i18n/locales/es.js';
import fr from '../src/i18n/locales/fr.js';
import pt from '../src/i18n/locales/pt.js';
import de from '../src/i18n/locales/de.js';
import it from '../src/i18n/locales/it.js';
import nl from '../src/i18n/locales/nl.js';
import ar from '../src/i18n/locales/ar.js';
import hi from '../src/i18n/locales/hi.js';
import zh from '../src/i18n/locales/zh.js';
import ja from '../src/i18n/locales/ja.js';
import { flattenLocaleKeys, normalizeLocaleResource } from '../src/i18n/locale-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locales = {
  en,
  es,
  fr,
  pt,
  de,
  it,
  nl,
  ar,
  hi,
  zh,
  ja
};

const normalizedLocales = Object.fromEntries(
  Object.entries(locales).map(([lang, locale]) => [lang, normalizeLocaleResource(locale)])
);

const englishKeys = new Set(flattenLocaleKeys(normalizedLocales.en));
const missing = [];
const emptyValues = [];

for (const [lang, locale] of Object.entries(normalizedLocales)) {
  if (lang === 'en') continue;

  const localeKeys = flattenLocaleKeys(locale);
  for (const key of englishKeys) {
    if (!localeKeys.includes(key)) {
      missing.push(`${lang}: missing ${key}`);
      continue;
    }

    const value = key.split('.').reduce((acc, segment) => {
      if (acc && typeof acc === 'object' && segment in acc) {
        return acc[segment];
      }
      return undefined;
    }, locale);

    if (typeof value !== 'string' || value.trim() === '') {
      emptyValues.push(`${lang}: empty ${key}`);
    }
  }
}

if (missing.length > 0 || emptyValues.length > 0) {
  console.error('i18n completeness check failed.');
  if (missing.length > 0) {
    console.error('Missing keys:');
    for (const entry of missing) console.error(`- ${entry}`);
  }
  if (emptyValues.length > 0) {
    console.error('Empty values:');
    for (const entry of emptyValues) console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log(`i18n completeness check passed for ${Object.keys(locales).length} locales.`);
