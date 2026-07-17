import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

process.env.JWT_SECRET ||= "test-secret";
process.env.FINGERPRINT_SECRET ||= "test-fingerprint-secret";
process.env.FRONTEND_URL ||= "http://localhost:5173";
process.env.CORS_ORIGIN ||= "http://localhost:5173";
process.env.MEDIA_STORAGE_DRIVER = "mock";
process.env.MODERATION_PROVIDER = "mock";
process.env.MODERATION_MOCK_FLAGGED = "false";
process.env.EMAIL_PROVIDER = "console";
process.env.SUPPORT_EMAIL ||= "support@example.com";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL || /test/i.test(process.env.DATABASE_URL || ""));
const run = hasTestDb ? describe : describe.skip;
let prisma;
let createApp;

async function resetDb() {
  await prisma.emailNotificationLog.deleteMany();
  await prisma.adminModerationLog.deleteMany();
  await prisma.blockedUploader.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
}

async function waitForEmailLog(template) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const logs = await prisma.emailNotificationLog.findMany({ where: { template } });
    if (logs.length) return logs;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return [];
}

run("private QR upload approval flow", () => {
  let app;
  let token;
  let trip;
  let uploadId;

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma } = await import("../../src/utils/prisma.js"));
    ({ createApp } = await import("../../src/app.js"));
    app = createApp();
    await resetDb();
  });

  it("keeps scanner uploads private until the owner approves them", async () => {
    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Maya Tourist", email: "maya@example.com", password: "Password123!" })
      .expect(201);

    token = signup.body.token;

    const created = await request(app)
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Barbados Beach Day", destination: "Barbados" })
      .expect(201);

    trip = created.body.trip;

    const landing = await request(app).get(`/api/public/qr/${trip.qrToken}`).expect(200);
    const cookie = landing.headers["set-cookie"];
    expect(cookie).toBeDefined();
    expect(landing.body.type).toBe("trip");
    expect(landing.body.data).toMatchObject({ id: trip.id, title: trip.title });
    expect(landing.body.trip.touristFirstName).toBe("Maya");

    const upload = await request(app)
      .post(`/api/public/qr/${trip.qrToken}/uploads`)
      .set("Cookie", cookie)
      .attach("file", Buffer.from("test-image"), { filename: "beach.jpg", contentType: "image/jpeg" })
      .expect(201);

    uploadId = upload.body.upload.id;
    expect(upload.body.upload.status).toBe("pending");
    expect(upload.body.upload.locationVisibility).toBe("hidden");
    expect(upload.body.upload.latitude).toBeNull();
    expect(upload.body.upload.longitude).toBeNull();

    const pending = await request(app)
      .get(`/api/trips/${trip.id}/uploads?status=pending`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(pending.body.uploads).toHaveLength(1);
    expect(pending.body.uploads[0].aiFlagged).toBe(false);
    expect(pending.body.uploads[0].moderationProvider).toBe("mock");

    const emailLogs = await waitForEmailLog("new-upload");
    expect(emailLogs.some((log) => log.template === "new-upload" && log.status === "sent")).toBe(true);

    await request(app)
      .patch(`/api/uploads/${uploadId}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(200);

    const share = await request(app)
      .post(`/api/trips/${trip.id}/share-links`)
      .set("Authorization", `Bearer ${token}`)
      .send({ pin: "1234" })
      .expect(201);

    await request(app)
      .post(`/api/public/share/${share.body.shareLink.token}/unlock`)
      .send({ pin: "0000" })
      .expect(401);

    const album = await request(app)
      .post(`/api/public/share/${share.body.shareLink.token}/unlock`)
      .send({ pin: "1234" })
      .expect(200);

    expect(album.body.trip.uploads).toHaveLength(1);
    expect(album.body.trip.uploads[0].id).toBe(uploadId);
  }, 15_000);
});
