import type { PasswordService } from '../../../src/common/password/password.service';
import type {
  TokenPair,
  TokenService,
} from '../../../src/auth/token/token.service';
import type { PrismaClient } from '../../../src/generated/prisma/client';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import {
  createArticleFixture,
  type ArticleFixtureInput,
  type TestArticle,
} from './article-fixture';
import {
  createUserFixture,
  type TestUser,
  type UserFixtureInput,
} from './user-fixture';

export interface AuthenticatedTestUser extends TestUser, TokenPair {
  readonly authorization: string;
}

export interface DatabaseFixtureFactory {
  user(overrides?: UserFixtureInput): Promise<TestUser>;
  article(input: ArticleFixtureInput): Promise<TestArticle>;
  resetSequence(): void;
}

export interface FixtureFactory extends DatabaseFixtureFactory {
  authenticatedUser(
    overrides?: UserFixtureInput,
  ): Promise<AuthenticatedTestUser>;
}

interface FixtureDependencies {
  readonly prisma: PrismaService | PrismaClient;
  readonly passwordService: PasswordService;
}

interface HttpFixtureDependencies extends FixtureDependencies {
  readonly tokenService: TokenService;
}

export function createDatabaseFixtureFactory(
  dependencies: FixtureDependencies,
): DatabaseFixtureFactory {
  let sequence = 0;
  const nextSequence = () => {
    sequence += 1;
    return sequence;
  };

  const user = (input?: UserFixtureInput) =>
    createUserFixture(
      dependencies.prisma,
      dependencies.passwordService,
      nextSequence(),
      input,
    );

  return {
    user,
    article: (input) =>
      createArticleFixture(dependencies.prisma, nextSequence(), input),
    resetSequence() {
      sequence = 0;
    },
  };
}

export function createFixtureFactory(
  dependencies: HttpFixtureDependencies,
): FixtureFactory {
  const fixtures = createDatabaseFixtureFactory(dependencies);

  return {
    ...fixtures,
    async authenticatedUser(input) {
      const created = await fixtures.user(input);
      const tokens = await dependencies.tokenService.issueTokens(created.id);

      return {
        ...created,
        ...tokens,
        authorization: `Bearer ${tokens.accessToken}`,
      };
    },
  };
}

export type { ArticleFixtureInput, TestArticle, TestUser, UserFixtureInput };
