import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  // Create a minimal admin user and a purchase item for local/dev testing.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Admin' },
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'seeded-password-hash',
      role: 'platform_admin'
    }
  });
  console.log('Seed complete:', { adminId: admin.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
