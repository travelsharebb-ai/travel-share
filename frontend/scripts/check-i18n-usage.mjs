import fs from "node:fs/promises";
import path from "node:path";

import en from "../src/i18n/locales/en.js";
import es from "../src/i18n/locales/es.js";
import fr from "../src/i18n/locales/fr.js";
import pt from "../src/i18n/locales/pt.js";
import de from "../src/i18n/locales/de.js";
import it from "../src/i18n/locales/it.js";
import nl from "../src/i18n/locales/nl.js";
import ar from "../src/i18n/locales/ar.js";
import hi from "../src/i18n/locales/hi.js";
import zh from "../src/i18n/locales/zh.js";
import ja from "../src/i18n/locales/ja.js";
import { flattenLocaleKeys, normalizeLocaleResource } from "../src/i18n/locale-utils.js";

const SOURCE_ROOT = path.resolve("./src");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const locales = { en, es, fr, pt, de, it, nl, ar, hi, zh, ja };

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (fullPath === path.join(SOURCE_ROOT, "i18n", "locales")) continue;
      files.push(...await walk(fullPath));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

const localeKeySets = Object.fromEntries(
  Object.entries(locales).map(([language, locale]) => [
    language,
    new Set(flattenLocaleKeys(normalizeLocaleResource(locale)))
  ])
);

const usages = new Map();
const files = await walk(SOURCE_ROOT);
const staticCallPattern = /\b(?:t|translate|i18n\.t)\s*\(\s*(["'])([^"']+)\1/g;

for (const file of files) {
  const source = stripComments(await fs.readFile(file, "utf8"));
  for (const match of source.matchAll(staticCallPattern)) {
    const key = match[2];
    if (!key.includes(".") || /\s/.test(key)) continue;
    const fallbackMatch = source.slice(match.index + match[0].length).match(/^\s*,\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/);
    const usage = usages.get(key) || { locations: [], fallback: null };
    usage.locations.push(`${path.relative(process.cwd(), file)}:${lineNumber(source, match.index)}`);
    usage.fallback ||= fallbackMatch?.[2] || null;
    usages.set(key, usage);
  }
}

const missing = [];
for (const [key, usage] of [...usages.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const languages = [];
  for (const [language, keys] of Object.entries(localeKeySets)) {
    if (!keys.has(key)) {
      languages.push(language);
    }
  }
  if (languages.length > 0) missing.push({ key, languages, ...usage });
}

if (missing.length > 0) {
  const missingEntryCount = missing.reduce((total, entry) => total + entry.languages.length, 0);
  console.error(`i18n usage check failed: ${missing.length} used keys have ${missingEntryCount} missing locale entries.`);
  for (const entry of missing) {
    const fallback = entry.fallback ? `; fallback: ${JSON.stringify(entry.fallback)}` : "";
    console.error(`- ${entry.key}: missing [${entry.languages.join(", ")}]${fallback} (used at ${entry.locations.join(", ")})`);
  }
  process.exit(1);
}

console.log(`i18n usage check passed: ${usages.size} static translation keys exist in all ${Object.keys(locales).length} locales.`);
