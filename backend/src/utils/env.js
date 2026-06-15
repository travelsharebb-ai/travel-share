export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}
