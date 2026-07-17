import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn()
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    notification: {
      findUnique: mocks.findUnique,
      update: mocks.update
    }
  }
}));

const { markRead } = await import("../src/services/notifications.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification read behavior", () => {
  it("marks only the notification owner's item as read", async () => {
    mocks.findUnique.mockResolvedValue({ id: "notification-1", userId: "user-1", readAt: null });
    mocks.update.mockImplementation(async ({ data }) => ({ id: "notification-1", userId: "user-1", ...data }));

    const updated = await markRead("user-1", "notification-1");

    expect(updated.readAt).toBeInstanceOf(Date);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: { readAt: expect.any(Date) }
    });
  });

  it("does not update another user's notification", async () => {
    mocks.findUnique.mockResolvedValue({ id: "notification-1", userId: "other-user", readAt: null });

    expect(await markRead("user-1", "notification-1")).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks notification card and Open clicks optimistically on desktop and mobile", async () => {
    const shell = await readFile(resolve(process.cwd(), "../frontend/src/components/Shell.jsx"), "utf8");

    expect(shell).toContain("async function markNotificationRead(notification)");
    expect(shell).toContain("entry.id === notification.id ? { ...entry, read: true");
    expect(shell).toContain("`/api/notifications/${notification.id}/read`");
    expect(shell).toContain("function openNotification(notification)");
    expect(shell).toContain("if (notification.targetUrl) navigate(notification.targetUrl)");
    expect(shell).not.toContain('href={notification.targetUrl}');
    expect(shell.match(/onClick=\{\(\) => activateNotification\(notification\)\}/g)).toHaveLength(2);
  });
});
