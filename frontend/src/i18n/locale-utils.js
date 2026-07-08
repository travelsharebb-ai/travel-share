const aliasPairs = [
  ["dashboard.quickActions.scanQR", "dashboard.quickActions.scanQr"],
  ["tourist.explore.scanQR", "tourist.explore.scanQr"]
];

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function setValueByPath(target, path, value) {
  const segments = path.split(".");
  let cursor = target;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
}

function getValueByPath(source, path) {
  const segments = path.split(".");
  let cursor = source;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

export function normalizeLocaleResource(resource) {
  if (!resource || typeof resource !== "object") {
    return resource;
  }

  const normalized = clone(resource);

  for (const [sourcePath, aliasPath] of aliasPairs) {
    const sourceValue = getValueByPath(normalized, sourcePath);
    if (sourceValue !== undefined) {
      const aliasValue = getValueByPath(normalized, aliasPath);
      if (aliasValue === undefined) {
        setValueByPath(normalized, aliasPath, sourceValue);
      }
    }
  }

  return normalized;
}

export function flattenLocaleKeys(value, prefix = "") {
  if (Array.isArray(value)) {
    return [];
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, childValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (childValue && typeof childValue === "object" && !Array.isArray(childValue)) {
        return flattenLocaleKeys(childValue, nextPrefix);
      }
      return [nextPrefix];
    });
  }

  return [];
}

export function getLocaleResources(localeModules) {
  return Object.fromEntries(
    Object.entries(localeModules).map(([lang, mod]) => {
      const resource = mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
      return [lang, { translation: normalizeLocaleResource(resource) }];
    })
  );
}
