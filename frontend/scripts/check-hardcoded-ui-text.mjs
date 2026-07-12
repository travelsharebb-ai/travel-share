import fs from "fs/promises";
import path from "path";

const ROOT = path.resolve("./src");
const TARGET_DIRS = ["pages", "components", "lib"].map((dir) => path.join(ROOT, dir));
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const VISIBLE_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"];
const VISIBLE_CALLS = ["alert", "confirm"];

const ALLOWED_EXACT = new Set([
  "TravelShare",
  "Travel Share",
  "QR",
  "ID",
  "URL",
  "API",
  "Mapbox",
  "Barbados",
  "Google",
  "Microsoft",
  "Stripe",
  "PayPal",
  "Cloudinary",
  "Redis",
  "JWT",
  "GPS"
]);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function walk(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function hasHumanEnglish(text) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return false;
  if (value.startsWith(":")) return false;
  if (/[`=;]/.test(value)) return false;
  if (/\)\s*:/.test(value) || /\?\s*\(/.test(value)) return false;
  if (/\b(const|let|var|return|if|else|true|false|null|undefined)\b/.test(value)) return false;
  if (/[&|]{2}/.test(value)) return false;
  if (ALLOWED_EXACT.has(value)) return false;
  if (/^[\d\s.,:;!?()+\-/%#]+$/.test(value)) return false;
  if (/^[^A-Za-z]+$/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (/^\/[A-Za-z0-9/_:.-]*$/.test(value)) return false;
  if (/^[A-Z0-9_]+$/.test(value)) return false;
  return /[A-Za-z]{2,}/.test(value);
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function isInsideImport(source, index) {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const lineEnd = source.indexOf("\n", index);
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
  return /^\s*import\s/.test(line) || /^\s*export\s+.*\sfrom\s/.test(line);
}

function isLikelyTranslationCall(source, index) {
  const before = source.slice(Math.max(0, index - 80), index);
  return /\b(t|translate)\s*\([^)]*$/.test(before);
}

function collectResults(file, source) {
  const results = [];
  const clean = stripComments(source);
  const rel = path.relative(process.cwd(), file);

  const jsxText = />\s*([^<>{}\n][^<>{}]*?[A-Za-z][^<>{}]*?)\s*</g;
  for (const match of clean.matchAll(jsxText)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (!hasHumanEnglish(text)) continue;
    results.push({ file: rel, line: lineNumber(clean, match.index), kind: "jsx-text", text });
  }

  const attrPattern = new RegExp(`\\b(${VISIBLE_ATTRIBUTES.join("|")})\\s*=\\s*["']([^"']*[A-Za-z][^"']*)["']`, "g");
  for (const match of clean.matchAll(attrPattern)) {
    const text = match[2].trim();
    if (!hasHumanEnglish(text) || isInsideImport(clean, match.index)) continue;
    results.push({ file: rel, line: lineNumber(clean, match.index), kind: match[1], text });
  }

  const callPattern = new RegExp(`(?:window\\.)?(${VISIBLE_CALLS.join("|")})\\s*\\(\\s*["']([^"']*[A-Za-z][^"']*)["']`, "g");
  for (const match of clean.matchAll(callPattern)) {
    const text = match[2].trim();
    if (!hasHumanEnglish(text) || isLikelyTranslationCall(clean, match.index)) continue;
    results.push({ file: rel, line: lineNumber(clean, match.index), kind: match[1], text });
  }

  return results;
}

const files = (await Promise.all(TARGET_DIRS.map(walk))).flat();
const results = [];

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  results.push(...collectResults(file, source));
}

if (!results.length) {
  console.log("No hardcoded visible English UI strings found.");
  process.exit(0);
}

console.log(`Hardcoded visible English UI strings found: ${results.length}`);
for (const result of results) {
  console.log(`- ${result.file}:${result.line} [${result.kind}] "${result.text}"`);
}
process.exit(1);
