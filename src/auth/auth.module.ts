import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordModule } from '../common/password/password.module';
import { EmailModule } from '../email/email.module';
import { AccountResolverService } from './account/account-resolver.service';
import { AccountUserRepository } from './account/account-user.repository';
import { AuthProviderRepository } from './account/auth-provider.repository';
import { PendingProviderLinkRepository } from './account-linking/pending-provider-link.repository';
import { ProviderLinkService } from './account-linking/provider-link.service';
import { ExpiredProviderLinkCleanupService } from './account-linking/expired-provider-link-cleanup.service';
import { RefreshTokenRepository } from './token/refresh-token.repository';
import { ExpiredTokenCleanupService } from './token/expired-token-cleanup.service';
import { DEFAULT_ACCESS_TOKEN_TTL, TokenService } from './token/token.service';

@Module({
  imports: [
    PrismaModule,
    PasswordModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_EXPIRES_IN') ??
            DEFAULT_ACCESS_TOKEN_TTL,
        } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RefreshTokenRepository,
    TokenService,
    ExpiredTokenCleanupService,
    AccountUserRepository,
    AuthProviderRepository,
    AccountResolverService,
    PendingProviderLinkRepository,
    ProviderLinkService,
    ExpiredProviderLinkCleanupService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    TokenService,
    AccountResolverService,
    ProviderLinkService,
    PendingProviderLinkRepository,
  ],
})
export class AuthModule {}
