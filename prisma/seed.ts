// prisma/seed.ts

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

// initialize Prisma Client with adapter
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // create a dummy user first
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      username: 'demo',
      password: 'demo123', // In production, this should be hashed
      bio: 'Demo user for testing',
    },
  });

  console.log('Created user:', user);

  // create two dummy articles using authorId (UncheckedCreateInput)
  const post1 = await prisma.article.upsert({
    where: { slug: 'prisma-adds-support-for-mongodb' },
    update: {},
    create: {
      slug: 'prisma-adds-support-for-mongodb',
      title: 'Prisma Adds Support for MongoDB',
      body: 'Support for MongoDB has been one of the most requested features since the initial release of...',
      description:
        "We are excited to share that today's Prisma ORM release adds stable support for MongoDB!",
      authorId: user.id,
    },
  });

  const post2 = await prisma.article.upsert({
    where: { slug: 'whats-new-in-prisma-q1-22' },
    update: {},
    create: {
      slug: 'whats-new-in-prisma-q1-22',
      title: "What's new in Prisma? (Q1/22)",
      body: 'Our engineers have been working hard, issuing new releases with many improvements...',
      description:
        'Learn about everything in the Prisma ecosystem and community from January to March 2022.',
      authorId: user.id,
    },
  });

  console.log({ post1, post2 });
}

// execute the main function
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // close Prisma Client at the end
    await prisma.$disconnect();
  });
