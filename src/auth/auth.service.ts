import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { PasswordService } from '../common/password/password.service';
import { TokenPair, TokenService } from './token/token.service';
import { AccountResolverService } from './account/account-resolver.service';
import { VerifiedIdentity } from './providers/verified-identity.interface';
import { FileStorageService } from '../file-storage/file-storage.service';

const DUMMY_SECRET_BYTES = 32;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly accountResolver: AccountResolverService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Warms the dummy hash so the first rejected login costs the same as every later one.
   * Deliberately here and not in the constructor: construction should not run work, and a
   * bcrypt failure surfaces at boot instead of as an unhandled rejection.
   */
  async onModuleInit(): Promise<void> {
    await this.dummyPasswordHash();
  }

  /**
   * Hashed through the same service and therefore the same cost factor, so comparing against
   * it takes as long as comparing against a real hash. Memoized, and the secret is random so
   * nobody holds a preimage for it.
   */
  private dummyPasswordHash(): Promise<string> {
    this.dummyHash ??= this.passwordService.hash(
      randomBytes(DUMMY_SECRET_BYTES).toString('hex'),
    );

    return this.dummyHash;
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, password } = dto;

    const existingEmail = await this.authRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.authRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await this.passwordService.hash(password);

    const user = await this.authRepository.create({
      email,
      username,
      password: hashedPassword,
    });

    const tokens = await this.tokenService.issueTokens(user.id);

    return new AuthResponseDto({
      email: user.email,
      username: user.username,
      bio: null,
      image: null,
      ...tokens,
    });
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = dto;

    const user = await this.authRepository.findByEmailWithPassword(email);

    // Every rejection path runs exactly one comparison. Returning early for an unknown
    // address, or for a provider-only account with no password, would answer faster than a
    // wrong password does and so disclose which of the three happened.
    const hashToCompare = user?.password ?? (await this.dummyPasswordHash());
    const isPasswordValid = await this.passwordService.compare(
      password,
      hashToCompare,
    );

    if (!user || user.password === null || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.issueTokens(user.id);

    return new AuthResponseDto({
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: this.fileStorage.publicUrl(user.image),
      ...tokens,
    });
  }

  refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    return this.tokenService.rotate(dto.refreshToken);
  }

  logout(dto: RefreshTokenDto): Promise<void> {
    return this.tokenService.revoke(dto.refreshToken);
  }

  async handleOAuthCallback(
    identity: VerifiedIdentity,
  ): Promise<AuthResponseDto> {
    const account = await this.accountResolver.resolve(identity);
    const tokens = await this.tokenService.issueTokens(account.id);

    return new AuthResponseDto({
      email: account.email,
      username: account.username,
      bio: account.bio,
      image: this.fileStorage.publicUrl(account.image),
      ...tokens,
    });
  }
}
