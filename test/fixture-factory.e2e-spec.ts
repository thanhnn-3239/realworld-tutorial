import { comparePassword } from '../src/common/password/password.service';
import { useE2eSuite } from './support/e2e-suite';

describe('E2E fixture factory', () => {
  const e2e = useE2eSuite('fixture-factory');

  it('creates deterministic unique users with real password hashes', async () => {
    const first = await e2e.fixtures.user();
    const second = await e2e.fixtures.user({ bio: 'Fixture bio' });

    expect(first.email).toBe('user-1@example.com');
    expect(second.email).toBe('user-2@example.com');
    expect(second.bio).toBe('Fixture bio');
    expect(first.password).not.toBe(first.plainPassword);
    await expect(
      comparePassword(first.plainPassword, first.password ?? ''),
    ).resolves.toBe(true);
  });

  it('issues tokens through the real token service', async () => {
    const user = await e2e.fixtures.authenticatedUser();

    expect(user.authorization).toBe(`Bearer ${user.accessToken}`);
    expect(user.refreshToken).not.toBe('');
    await expect(
      e2e.prisma.refreshToken.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
  });

  it('honors every narrow user override', async () => {
    const user = await e2e.fixtures.user({
      email: 'custom@example.com',
      username: 'custom_user',
      password: 'custom-password',
      bio: 'Custom bio',
      image: 'avatars/custom.png',
    });

    expect(user).toMatchObject({
      email: 'custom@example.com',
      username: 'custom_user',
      plainPassword: 'custom-password',
      bio: 'Custom bio',
      image: 'avatars/custom.png',
    });
    await expect(
      comparePassword(user.plainPassword, user.password ?? ''),
    ).resolves.toBe(true);
  });

  it('creates articles and requested tags through Prisma', async () => {
    const author = await e2e.fixtures.user();
    const article = await e2e.fixtures.article({
      authorId: author.id,
      title: 'Fixture article',
      tags: ['nestjs', 'e2e'],
    });

    expect(article.title).toBe('Fixture article');
    expect(article.tagList.map((tag) => tag.name).sort()).toEqual([
      'e2e',
      'nestjs',
    ]);
  });

  it('restarts defaults after the per-test reset', async () => {
    const user = await e2e.fixtures.user();

    expect(user.email).toBe('user-1@example.com');
    await expect(e2e.prisma.user.count()).resolves.toBe(1);
  });

  it('does not create unrelated social or provider records', async () => {
    await e2e.fixtures.user();

    const [providers, comments, favorites] = await Promise.all([
      e2e.prisma.authProvider.count(),
      e2e.prisma.comment.count(),
      e2e.prisma.article.count({ where: { favoritedBy: { some: {} } } }),
    ]);
    const user = await e2e.prisma.user.findFirstOrThrow({
      include: { following: true, followedBy: true },
    });

    expect({ providers, comments, favorites }).toEqual({
      providers: 0,
      comments: 0,
      favorites: 0,
    });
    expect(user.following).toEqual([]);
    expect(user.followedBy).toEqual([]);
  });
});
