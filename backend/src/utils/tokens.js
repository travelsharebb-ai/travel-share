import crypto from "node:crypto";
import { nanoid } from "nanoid";

export function secureToken(size = 32) {
  return crypto.randomBytes(size).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function anonId() {
  return `anon-${nanoid(8)}`;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, decodeURIComponent(value.join("=") || "")];
    }).filter(([key]) => key)
  );
}

function ipBucket(ip = "unknown") {
  const clean = ip.replace(/^::ffff:/, "");

  if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) {
    return clean.split(".").slice(0, 3).join(".");
  }

  if (clean.includes(":")) {
    return clean.split(":").slice(0, 4).join(":");
  }

  return "unknown";
}

function shortHash(value) {
  return crypto.createHash("sha256").update(value || "unknown").digest("hex").slice(0, 16);
}

export function getOrSetUploaderSession(req, res) {
  const cookies = parseCookies(req.get("cookie"));
  const existing = cookies.ts_uploader;
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;

  const created = secureToken(18);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `ts_uploader=${encodeURIComponent(created)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  return created;
}

export function readCookie(req, name) {
  return parseCookies(req.get("cookie"))[name];
}

export function setGuestSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `ts_guest=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 3}${secure}`);
}

export function fingerprintFromRequest(req) {
  const secret = process.env.FINGERPRINT_SECRET || process.env.JWT_SECRET || "local-dev-fingerprint-secret";
  const sessionToken = parseCookies(req.get("cookie")).ts_uploader || "no-session";
  const raw = [
    ipBucket(req.ip),
    shortHash(req.get("user-agent")),
    shortHash(req.get("accept-language")),
    shortHash(sessionToken)
  ].join("|");

  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}
