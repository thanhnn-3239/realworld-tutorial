import { AUTH_VALIDATION } from '../auth/auth.config';
import { PrismaClient } from '../generated/prisma/client';
import { maxLength, minLength } from 'class-validator';
import { hashPassword } from '../common/password/password.service';

const DEMO_ERROR = 'DEMO_USER_PASSWORD is not configured correctly.';
const DEMO_EMAIL = 'demo@example.com';
const DEMO_USERNAME = 'demo';
const DEMO_BIO = 'Demo user for testing';
const DEMO_ARTICLES = [
  {
    slug: 'prisma-adds-support-for-mongodb',
    title: 'Prisma Adds Support for MongoDB',
    description:
      "We are excited to share that today's Prisma ORM release adds stable support for MongoDB!",
    body: 'Support for MongoDB has been one of the most requested features since the initial release of...',
  },
  {
    slug: 'whats-new-in-prisma-q1-22',
    title: "What's new in Prisma? (Q1/22)",
    description:
      'Learn about everything in the Prisma ecosystem and community from January to March 2022.',
    body: 'Our engineers have been working hard, issuing new releases with many improvements...',
  },
] as const;

type SeedPrisma = Pick<PrismaClient, 'user' | 'article'>;

export class DemoSeedConfigurationError extends Error {
  constructor() {
    super(DEMO_ERROR);
    this.name = 'DemoSeedConfigurationError';
  }
}

export function validateDemoPassword(password: string | undefined): string {
  if (
    !password ||
    !minLength(password, AUTH_VALIDATION.password.minLength) ||
    !maxLength(password, AUTH_VALIDATION.password.maxLength)
  ) {
    throw new DemoSeedConfigurationError();
  }

  return password;
}

export async function seedDemoData(
  prisma: SeedPrisma,
  demoPassword: string,
): Promise<void> {
  const hashedPassword = await hashPassword(demoPassword);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      username: DEMO_USERNAME,
      password: hashedPassword,
      bio: DEMO_BIO,
    },
    create: {
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      password: hashedPassword,
      bio: DEMO_BIO,
    },
  });

  for (const article of DEMO_ARTICLES) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: { ...article, authorId: user.id },
      create: { ...article, authorId: user.id },
    });
  }
}
