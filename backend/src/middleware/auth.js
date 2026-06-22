import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Authentication required." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) return res.status(401).json({ error: "Invalid session." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session." });
  }
}

export function requireAdmin(req, res, next) {
  if (!["admin", "platform_admin"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

export function requireOrganizerOrAdmin(req, res, next) {
  if (!["admin", "platform_admin", "organizer"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Organizer access required." });
  }
  next();
}

export function isPlatformAdmin(user) {
  return ["admin", "platform_admin"].includes(user?.role);
}
