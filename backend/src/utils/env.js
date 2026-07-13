export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

const WEAK_VALUES = /^(change-?me|default|test|secret|password|development|local|123456|replace[-_]?me)$/i;

export function isWeakSecret(value) {
  const normalized = String(value || "").trim();
  return normalized.length < 16 || WEAK_VALUES.test(normalized);
}

function enabled(name, env = process.env) {
  return String(env[name] || "").toLowerCase() === "true";
}

export function productionEnvIssues(env = process.env) {
  const missing = [];
  const weak = [];
  const required = [
    "DATABASE_URL", "JWT_SECRET", "FINGERPRINT_SECRET", "FRONTEND_URL", "CORS_ORIGIN",
    "BACKEND_URL", "APP_NAME", "SUPPORT_EMAIL", "ADMIN_EMAIL", "MEDIA_STORAGE_DRIVER",
    "GUEST_ACCESS_DAYS", "GUEST_DELETION_DAYS"
  ];
  for (const name of required) if (!env[name]) missing.push(name);
  for (const name of ["JWT_SECRET", "FINGERPRINT_SECRET"]) {
    if (env[name] && isWeakSecret(env[name])) weak.push(name);
  }
  for (const name of [
    "CLOUDINARY_API_SECRET", "S3_SECRET_ACCESS_KEY", "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYPAL_CLIENT_SECRET", "SENDGRID_API_KEY"
  ]) {
    if (env[name] && isWeakSecret(env[name])) weak.push(name);
  }

  if (!env.REDIS_URL && !env.REDIS_TLS_URL) missing.push("REDIS_URL or REDIS_TLS_URL");
  const storage = String(env.MEDIA_STORAGE_DRIVER || env.STORAGE_PROVIDER || "").toLowerCase();
  if (storage === "cloudinary" && !(env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET))) {
    missing.push("CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET");
  }
  if (["s3", "r2"].includes(storage)) {
    for (const name of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) if (!env[name]) missing.push(name);
    if (storage === "r2" && !env.S3_ENDPOINT) missing.push("S3_ENDPOINT");
  }

  const googleEnabled = enabled("GOOGLE_OAUTH_ENABLED", env) || Boolean(env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET);
  if (googleEnabled) for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) if (!env[name]) missing.push(name);
  const microsoftEnabled = enabled("MICROSOFT_OAUTH_ENABLED", env) || Boolean(env.MICROSOFT_CLIENT_ID || env.MICROSOFT_CLIENT_SECRET);
  if (microsoftEnabled) for (const name of ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"]) if (!env[name]) missing.push(name);

  const paymentProvider = String(env.PAYMENT_PROVIDER || "disabled").toLowerCase();
  if (["stripe", "both"].includes(paymentProvider)) for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) if (!env[name]) missing.push(name);
  if (["paypal", "both"].includes(paymentProvider)) for (const name of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]) if (!env[name]) missing.push(name);
  const emailEnabled = String(env.EMAIL_PROVIDER || "disabled").toLowerCase() === "sendgrid" || Boolean(env.SENDGRID_API_KEY);
  if (emailEnabled) for (const name of ["SENDGRID_API_KEY", "EMAIL_FROM"]) if (!env[name]) missing.push(name);

  return { missing: [...new Set(missing)], weak: [...new Set(weak)] };
}

export function validateProductionEnv() {
  const issues = productionEnvIssues();
  const failures = [];
  if (issues.missing.length) failures.push(`Missing: ${issues.missing.join(", ")}.`);
  if (issues.weak.length) failures.push(`Weak: ${issues.weak.join(", ")}.`);

  const localMediaAllowed = process.env.ALLOW_LOCAL_MEDIA_IN_PRODUCTION === "true" || process.env.ALLOW_LOCAL_STORAGE === "true";

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
  if (isWeakSecret(process.env.JWT_SECRET)) {
    warnings.push('JWT_SECRET appears to be a placeholder or missing - set a strong secret in production.');
  }
  if (isWeakSecret(process.env.FINGERPRINT_SECRET)) {
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
