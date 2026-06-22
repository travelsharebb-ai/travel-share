import { moderateMedia as _moderateMedia } from "../utils/moderation.js";

export async function moderateSafe(media) {
  try {
    // ensure we never throw to caller
    const result = await _moderateMedia(media);
    return result || { provider: process.env.MODERATION_PROVIDER || "disabled", status: "ok", aiFlagged: false, labels: null };
  } catch (err) {
    return { provider: process.env.MODERATION_PROVIDER || "disabled", status: "error", aiFlagged: true, labels: { error: err.message } };
  }
}
