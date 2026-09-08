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
import { AccountResolverService } from './account/account-resolver.service';
import { AccountUserRepository } from './account/account-user.repository';
import { AuthProviderRepository } from './account/auth-provider.repository';
import { RefreshTokenRepository } from './token/refresh-token.repository';
import {
  DEFAULT_ACCESS_TOKEN_TTL,
  TokenService,
} from './token/token.service';

@Module({
  imports: [
    PrismaModule,
    PasswordModule,
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
    AccountUserRepository,
    AuthProviderRepository,
    AccountResolverService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    TokenService,
    AccountResolverService,
  ],
})
export class AuthModule {}
