import "dotenv/config";
import bcrypt from "bcryptjs";
import { secureToken } from "../src/utils/tokens.js";

if (!process.env.TEST_DATABASE_URL && !/test/i.test(process.env.DATABASE_URL || "")) {
  throw new Error("Refusing to seed: set TEST_DATABASE_URL or use a DATABASE_URL containing 'test'.");
}

async function main() {
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { prisma } = await import("../src/utils/prisma.js");

  await prisma.emailNotificationLog.deleteMany();
  await prisma.adminModerationLog.deleteMany();
  await prisma.blockedUploader.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 12);
  const user = await prisma.user.create({
    data: {
      name: "Maya Tourist",
      email: "maya@example.com",
      passwordHash
    }
  });

  await prisma.trip.create({
    data: {
      userId: user.id,
      title: "Barbados Beach Day",
      destination: "Barbados",
      qrToken: secureToken(24)
    }
  });
  await prisma.$disconnect();
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
