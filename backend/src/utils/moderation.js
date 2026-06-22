const unsafeThreshold = Number(process.env.MODERATION_UNSAFE_THRESHOLD || 0.75);

function flattenScores(payload) {
  const labels = {};

  for (const [key, value] of Object.entries(payload || {})) {
    if (typeof value === "number") labels[key] = value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (typeof childValue === "number") labels[`${key}.${childKey}`] = childValue;
      }
    }
  }

  return labels;
}

function isUnsafe(labels) {
  return Object.entries(labels).some(([label, score]) => {
    const risky = /(nudity|weapon|gore|offensive|violence|alcohol|drugs|medical|scam|self-harm)/i.test(label);
    return risky && score >= unsafeThreshold;
  });
}

export async function moderateMedia({ fileUrl, fileType }) {
  const provider = process.env.MODERATION_PROVIDER || "disabled";

  if (provider === "disabled") {
    return { provider, status: "skipped", aiFlagged: false, labels: {} };
  }

  if (provider === "mock") {
    const aiFlagged = process.env.MODERATION_MOCK_FLAGGED === "true";
    return {
      provider,
      status: aiFlagged ? "flagged" : "clear",
      aiFlagged,
      labels: aiFlagged ? { "nudity.safe": 0.1, "offensive.prob": 0.9 } : { "nudity.safe": 0.99 }
    };
  }

  if (provider !== "sightengine") {
    throw new Error(`Unsupported moderation provider: ${provider}`);
  }

  if (!process.env.SIGHTENGINE_API_USER || !process.env.SIGHTENGINE_API_SECRET) {
    throw new Error("Sightengine moderation requires SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET.");
  }

  const endpoint = fileType === "video"
    ? "https://api.sightengine.com/1.0/video/check-sync.json"
    : "https://api.sightengine.com/1.0/check.json";
  const params = new URLSearchParams({
    url: fileUrl,
    models: process.env.SIGHTENGINE_MODELS || "nudity-2.1,weapon,gore-2.0,offensive,violence",
    api_user: process.env.SIGHTENGINE_API_USER,
    api_secret: process.env.SIGHTENGINE_API_SECRET
  });

  const response = await fetch(`${endpoint}?${params.toString()}`);
  const payload = await response.json();
  if (!response.ok || payload.status === "failure") {
    throw new Error(payload.error?.message || "Moderation provider request failed.");
  }

  const labels = flattenScores(payload);
  const aiFlagged = isUnsafe(labels);
  return {
    provider,
    status: aiFlagged ? "flagged" : "clear",
    aiFlagged,
    labels
  };
}
