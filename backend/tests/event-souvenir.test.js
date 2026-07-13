import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("../src/utils/prisma.js", () => ({ prisma: { event: { findFirst } } }));
const { publicEventSouvenir } = await import("../src/controllers/publicController.js");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe("public event souvenir privacy", () => {
  beforeEach(() => findFirst.mockReset());

  it("queries only completed public/unlisted events and approved uploads", async () => {
    findFirst.mockResolvedValue({ id: "event-1", uploads: [{ id: "upload-1" }] });
    const res = response();
    await publicEventSouvenir({ params: { eventId: "event-1" } }, res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ visibility: { in: ["public", "unlisted"] }, status: { in: ["ended", "archived"] } }),
      select: expect.objectContaining({ uploads: expect.objectContaining({ where: { status: "approved" } }) })
    }));
  });

  it("does not expose unavailable or private events", async () => {
    findFirst.mockResolvedValue(null);
    const res = response();
    await publicEventSouvenir({ params: { eventId: "private-event" } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });
});
