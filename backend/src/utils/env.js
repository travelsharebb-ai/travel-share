export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

export function warnIfPlaceholderSecrets() {
  const warnings = [];
  if (!process.env.JWT_SECRET || /change-me|default|test/i.test(process.env.JWT_SECRET)) {
    warnings.push('JWT_SECRET appears to be a placeholder or missing — set a strong secret in production.');
  }
  if (!process.env.FINGERPRINT_SECRET || /change-me|default|test/i.test(process.env.FINGERPRINT_SECRET)) {
    warnings.push('FINGERPRINT_SECRET appears to be a placeholder or missing — set a strong secret in production.');
  }
  return warnings;
}

export function listOptionalEnvRecommendations() {
  const recommended = [
    'CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET',
    'STRIPE_SECRET_KEY (if you enable Stripe payments)',
    'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (if using PayPal)',
    'VITE_MAPBOX_TOKEN (for production maps)',
    'REDIS_URL (recommended for rate-limiting)'
  ];
  const missing = recommended.filter((r) => {
    if (r.startsWith('CLOUDINARY_URL')) return !(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
    if (r.includes('STRIPE')) return !process.env.STRIPE_SECRET_KEY;
    if (r.includes('PAYPAL')) return !(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    if (r.includes('MAPBOX')) return !process.env.VITE_MAPBOX_TOKEN && !process.env.MAPBOX_TOKEN;
    if (r.includes('REDIS')) return !process.env.REDIS_URL;
    return false;
  });
  return missing;
}
