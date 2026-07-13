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
const placeholderMismatches = [];
const malformedValues = [];
const untranslatedValues = [];

const allowedUnchangedKeys = Object.fromEntries(Object.entries({
  es: ['common.no', 'qrSpaces.no', 'authPage.google', 'authPage.microsoft', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination', 'admin.ads.placementGlobal'],
  fr: ['qrSpaces.targetAlbum', 'qrSpaces.latitude', 'qrSpaces.longitude', 'qrSpaces.expiresAt', 'admin.reports.photos', 'admin.users.table.actions', 'admin.management.message', 'events.stats.zones', 'authPage.google', 'authPage.microsoft', 'eventDetails.zones', 'publicUpload.qrLabel', 'tripCreate.labelDestination', 'tripCreate.visibility.exact', 'uploadSuccess.defaultDestination', 'admin.ads.placementGlobal', 'admin.ads.impressions', 'admin.backups.source', 'admin.tools.dryRunMessage'],
  pt: ['qrSpaces.latitude', 'qrSpaces.longitude', 'authPage.google', 'authPage.microsoft', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination', 'admin.ads.status', 'admin.ads.placementGlobal'],
  de: ['qrSpaces.targetAlbum', 'shell.roles.admin', 'shell.roles.tourist', 'settingsPage.newEmailPlaceholder', 'settingsPage.guestStatusLabel', 'admin.reports.videos', 'admin.management.uploads', 'events.stats.uploads', 'authPage.google', 'authPage.microsoft', 'hardcoded.token', 'media.video', 'myUploads.status', 'publicTripJoin.tokenLabel', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination', 'admin.ads.status', 'admin.ads.placementGlobal', 'admin.ads.placementTourist', 'admin.audit.system', 'admin.backups.status'],
  it: ['common.no', 'qrSpaces.targetAlbum', 'qrSpaces.no', 'authPage.google', 'authPage.microsoft', 'hardcoded.zoom', 'media.video', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination'],
  nl: ['qrSpaces.targetAlbum', 'qrSpaces.details', 'shell.notificationTypes.info', 'settingsPage.guestStatusLabel', 'admin.management.uploads', 'events.actions.scanQr', 'events.stats.uploads', 'events.stats.zones', 'authPage.google', 'authPage.microsoft', 'hardcoded.token', 'hardcoded.zoom', 'media.video', 'qrScanner.title', 'eventDetails.zones', 'myUploads.status', 'publicTripJoin.tokenLabel', 'publicUpload.qrLabel', 'tripCreate.visibility.exact', 'uploadSuccess.defaultDestination', 'admin.ads.status', 'admin.data.countUploads', 'admin.backups.status'],
  ar: ['settingsPage.newEmailPlaceholder', 'authPage.google', 'authPage.microsoft', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination'],
  hi: ['settingsPage.newEmailPlaceholder', 'authPage.google', 'authPage.microsoft', 'hardcoded.token', 'publicTripJoin.tokenLabel', 'publicUpload.qrLabel', 'uploadSuccess.defaultDestination'],
  zh: [],
  ja: []
}).map(([lang, keys]) => [lang, new Set(keys)]));
const globallyAllowedUnchangedKeys = new Set([
  'admin.tools.confirmationPlaceholder'
]);

function valueAtPath(locale, key) {
  return key.split('.').reduce((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) return acc[segment];
    return undefined;
  }, locale);
}

function interpolationTokens(value) {
  return (String(value).match(/\{\{?[^{}]+\}\}?/g) || []).sort();
}

for (const [lang, locale] of Object.entries(normalizedLocales)) {
  if (lang === 'en') continue;

  const localeKeys = flattenLocaleKeys(locale);
  for (const key of englishKeys) {
    if (!localeKeys.includes(key)) {
      missing.push(`${lang}: missing ${key}`);
      continue;
    }

    const value = valueAtPath(locale, key);

    if (typeof value !== 'string' || value.trim() === '') {
      emptyValues.push(`${lang}: empty ${key}`);
      continue;
    }

    const englishValue = valueAtPath(normalizedLocales.en, key);
    const expectedTokens = interpolationTokens(englishValue);
    const actualTokens = interpolationTokens(value);
    if (expectedTokens.join('|') !== actualTokens.join('|')) {
      placeholderMismatches.push(`${lang}: ${key} expected [${expectedTokens.join(', ')}], found [${actualTokens.join(', ')}]`);
    }

    if (/Z[A-Z]{2,}[0-9]+[A-Z]+|TSSEP|QXZ/.test(value)) {
      malformedValues.push(`${lang}: malformed translation marker in ${key}`);
    }

    if (
      typeof englishValue === 'string' &&
      /[A-Za-z]{2}/.test(englishValue) &&
      value === englishValue &&
      !allowedUnchangedKeys[lang]?.has(key) &&
      !globallyAllowedUnchangedKeys.has(key)
    ) {
      untranslatedValues.push(`${lang}: untranslated ${key} = ${JSON.stringify(value)}`);
    }
  }
}

if (missing.length > 0 || emptyValues.length > 0 || placeholderMismatches.length > 0 || malformedValues.length > 0 || untranslatedValues.length > 0) {
  console.error('i18n completeness check failed.');
  if (missing.length > 0) {
    console.error('Missing keys:');
    for (const entry of missing) console.error(`- ${entry}`);
  }
  if (emptyValues.length > 0) {
    console.error('Empty values:');
    for (const entry of emptyValues) console.error(`- ${entry}`);
  }
  if (placeholderMismatches.length > 0) {
    console.error('Placeholder mismatches:');
    for (const entry of placeholderMismatches) console.error(`- ${entry}`);
  }
  if (malformedValues.length > 0) {
    console.error('Malformed translated values:');
    for (const entry of malformedValues) console.error(`- ${entry}`);
  }
  if (untranslatedValues.length > 0) {
    console.error('English values copied into non-English locales:');
    for (const entry of untranslatedValues) console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log(`i18n completeness check passed for ${Object.keys(locales).length} locales.`);
