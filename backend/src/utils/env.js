export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

function isPlaceholderSecret(value) {
  return !value || /^(change-me|default|test|secret|changeme|replace-me|replace_me)$/i.test(value);
}

export function validateProductionEnv() {
  requireEnv(["DATABASE_URL", "JWT_SECRET", "FINGERPRINT_SECRET", "FRONTEND_URL"]);

  const localMediaAllowed = process.env.ALLOW_LOCAL_MEDIA_IN_PRODUCTION === "true" || process.env.ALLOW_LOCAL_STORAGE === "true";

  const failures = [];
  if (isPlaceholderSecret(process.env.JWT_SECRET)) {
    failures.push("JWT_SECRET must be a strong non-placeholder secret.");
  }
  if (isPlaceholderSecret(process.env.FINGERPRINT_SECRET)) {
    failures.push("FINGERPRINT_SECRET must be a strong non-placeholder secret.");
  }

  const storageProvider = (process.env.STORAGE_PROVIDER || process.env.MEDIA_STORAGE_DRIVER || "local").toLowerCase();
  if ((storageProvider === "local" || storageProvider === "disk") && !localMediaAllowed) {
    failures.push("Local/disk media storage is disabled in production unless ALLOW_LOCAL_MEDIA_IN_PRODUCTION=true or ALLOW_LOCAL_STORAGE=true is set explicitly.");
  }
  if (storageProvider === "cloudinary") {
    const hasCloudinary = process.env.CLOUDINARY_URL || (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    if (!hasCloudinary) {
      failures.push("Cloudinary storage requires CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.");
    }
  }
  if (storageProvider === "s3") {
    const missingS3 = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((name) => !process.env[name]);
    if (missingS3.length) {
      failures.push(`S3 storage is missing ${missingS3.join(", ")}.`);
    }
  }
  if (process.env.SENDGRID_API_KEY && !process.env.EMAIL_FROM) {
    failures.push("EMAIL_FROM is required when SENDGRID_API_KEY is configured.");
  }

  if (failures.length) {
    throw new Error(`Production environment validation failed: ${failures.join(" ")}`);
  }
}

export function warnIfPlaceholderSecrets() {
  const warnings = [];
  if (isPlaceholderSecret(process.env.JWT_SECRET)) {
    warnings.push('JWT_SECRET appears to be a placeholder or missing - set a strong secret in production.');
  }
  if (isPlaceholderSecret(process.env.FINGERPRINT_SECRET)) {
    warnings.push('FINGERPRINT_SECRET appears to be a placeholder or missing - set a strong secret in production.');
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
