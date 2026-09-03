import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FavoritesRepository } from '../src/favorites/favorites.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('FavoritesRepository (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let repository: FavoritesRepository | undefined;
  let prisma: PrismaService | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('favorites_repository');
    app = await createTestApp(db);
    repository = app.get(FavoritesRepository);
    prisma = app.get(PrismaService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function repo() {
    if (!repository) {
      throw new Error('FavoritesRepository e2e is not initialized');
    }
    return repository;
  }

  function database() {
    if (!prisma) {
      throw new Error('FavoritesRepository e2e database is not initialized');
    }
    return prisma;
  }

  /** Registers over HTTP so the password hashing path is real, then reads the id back. */
  async function createUser() {
    fixtureNumber += 1;
    const id = `${process.pid}${fixtureNumber}`;
    const username = `favrepo_${id}`;
    await request(app!.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `favrepo-${id}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return database().user.findUniqueOrThrow({
      where: { username },
      select: { id: true, username: true },
    });
  }

  async function createArticle(authorId: number) {
    fixtureNumber += 1;
    const slug = `favrepo-article-${process.pid}${fixtureNumber}`;
    await database().article.create({
      data: {
        slug,
        title: 'Favorites repository article',
        description: 'Description',
        body: 'Body',
        authorId,
      },
      select: { id: true },
    });
    return slug;
  }

  it('returns the post-mutation count and the viewer flag from connect', async () => {
    const author = await createUser();
    const fan = await createUser();
    const slug = await createArticle(author.id);

    const result = await repo().connect(slug, fan.id);

    expect(result._count.favoritedBy).toBe(1);
    expect(result.favoritedBy).toEqual([{ id: fan.id }]);
  });

  it('returns the post-mutation count and an empty flag from disconnect', async () => {
    const author = await createUser();
    const fan = await createUser();
    const slug = await createArticle(author.id);
    await repo().connect(slug, fan.id);

    const result = await repo().disconnect(slug, fan.id);

    expect(result._count.favoritedBy).toBe(0);
    expect(result.favoritedBy).toEqual([]);
  });

  it('counts every favoriter globally but scopes the flag to the viewer', async () => {
    const author = await createUser();
    const fanA = await createUser();
    const fanB = await createUser();
    const slug = await createArticle(author.id);

    await repo().connect(slug, fanA.id);
    const asFanB = await repo().connect(slug, fanB.id);

    expect(asFanB._count.favoritedBy).toBe(2);
    expect(asFanB.favoritedBy).toEqual([{ id: fanB.id }]);
  });

  it('treats disconnect of an absent edge as a no-op rather than an error', async () => {
    const author = await createUser();
    const stranger = await createUser();
    const slug = await createArticle(author.id);

    const result = await repo().disconnect(slug, stranger.id);

    expect(result._count.favoritedBy).toBe(0);
    expect(result.favoritedBy).toEqual([]);
  });

  it('permits an author to favorite their own article', async () => {
    const author = await createUser();
    const slug = await createArticle(author.id);

    const result = await repo().connect(slug, author.id);

    expect(result._count.favoritedBy).toBe(1);
    expect(result.favoritedBy).toEqual([{ id: author.id }]);
  });
});
