import "dotenv/config";
import { prisma } from "../src/utils/prisma.js";

async function run() {
  const now = new Date();
  const placement = process.argv[2];
  try {
    const ads = await prisma.internalAd.findMany({
      where: {
        active: true,
        placement: placement ? { in: ["global", placement] } : undefined,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 10
    });
    console.log('ads length', ads.length);
    console.dir(ads, { depth: 2 });
  } catch (err) {
    console.error('ERROR running ads query:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

run();
