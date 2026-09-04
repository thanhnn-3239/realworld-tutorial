import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  DemoSeedConfigurationError,
  seedDemoData,
  validateDemoPassword,
} from '../src/demo-seed/demo-seed.service';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const demoPassword = validateDemoPassword(process.env.DEMO_USER_PASSWORD);
    await seedDemoData(prisma, demoPassword);
    console.log('Demo seed completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof DemoSeedConfigurationError
    ? error.message
    : 'Demo seed failed.';
  console.error(message);
  process.exit(1);
});
