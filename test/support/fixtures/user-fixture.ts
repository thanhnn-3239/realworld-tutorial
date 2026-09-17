import type { User } from '../../../src/generated/prisma/client';
import type { PasswordService } from '../../../src/common/password/password.service';

export interface UserFixtureInput {
  readonly email?: string;
  readonly username?: string;
  readonly password?: string;
  readonly bio?: string | null;
  readonly image?: string | null;
}

export interface TestUser extends User {
  readonly plainPassword: string;
}

interface UserFixturePrisma {
  readonly user: {
    create(args: {
      data: {
        email: string;
        username: string;
        password: string;
        bio?: string | null;
        image?: string | null;
      };
    }): Promise<User>;
  };
}

export async function createUserFixture(
  prisma: UserFixturePrisma,
  passwordService: PasswordService,
  sequence: number,
  input: UserFixtureInput = {},
): Promise<TestUser> {
  const plainPassword = input.password ?? 'password123';
  const user = await prisma.user.create({
    data: {
      email: input.email ?? `user-${sequence}@example.com`,
      username: input.username ?? `user_${sequence}`,
      password: await passwordService.hash(plainPassword),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
    },
  });

  return { ...user, plainPassword };
}
