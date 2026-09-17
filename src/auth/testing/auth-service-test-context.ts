import { PasswordService } from '../../common/password/password.service';
import { FileStorageService } from '../../file-storage/file-storage.service';
import { ProviderLinkService } from '../account-linking/provider-link.service';
import { AccountResolverService } from '../account/account-resolver.service';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { TokenService } from '../token/token.service';

export const TOKEN_PAIR = {
  accessToken: 'access.jwt',
  refreshToken: 'refresh-opaque',
};

export const STORED_USER = {
  id: 7,
  email: 'jake@jake.jake',
  username: 'jake',
  password: 'hashed',
  bio: 'I work at statefarm',
  image: null,
};

export function createAuthServiceTestContext() {
  const repository = {
    create: jest.fn().mockResolvedValue({ ...STORED_USER, bio: null }),
    findByEmail: jest.fn().mockResolvedValue(null),
    findByUsername: jest.fn().mockResolvedValue(null),
    findByEmailWithPassword: jest.fn().mockResolvedValue(STORED_USER),
  };
  const tokenService = {
    issueTokens: jest.fn().mockResolvedValue(TOKEN_PAIR),
    rotate: jest.fn().mockResolvedValue(TOKEN_PAIR),
    revoke: jest.fn().mockResolvedValue(undefined),
  };
  const passwordService = {
    hash: jest.fn((plain: string) => Promise.resolve(`hashed:${plain}`)),
    compare: jest.fn().mockResolvedValue(true),
  };
  const accountResolver = {
    resolve: jest.fn().mockResolvedValue({
      kind: 'account',
      account: {
        id: STORED_USER.id,
        email: STORED_USER.email,
        username: STORED_USER.username,
        bio: STORED_USER.bio,
        image: STORED_USER.image,
      },
    }),
  };
  const providerLinks = {
    confirm: jest.fn().mockResolvedValue({ kind: 'confirmed' }),
  };
  const fileStorage = {
    publicUrl: jest.fn((key: string | null) =>
      key === null ? null : `https://cdn.test/${key}`,
    ),
  };

  const service = new AuthService(
    repository as unknown as AuthRepository,
    tokenService as unknown as TokenService,
    passwordService as unknown as PasswordService,
    accountResolver as unknown as AccountResolverService,
    fileStorage as unknown as FileStorageService,
    providerLinks as unknown as ProviderLinkService,
  );

  return {
    service,
    repository,
    tokenService,
    passwordService,
    accountResolver,
    providerLinks,
    fileStorage,
  };
}
