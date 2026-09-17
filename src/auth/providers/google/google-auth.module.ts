import { DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from '../../auth.module';
import { GoogleAuthController } from './google-auth.controller';
import { GOOGLE_AUTH_CONFIG, readGoogleAuthConfig } from './google-auth.config';
import { GoogleStrategy } from './google.strategy';

@Module({})
export class GoogleAuthModule {
  /**
   * Registers nothing when configuration is incomplete, so the routes are absent (404) and
   * the application still boots. Contrast `JwtStrategy`, which rightly throws without its
   * secret: the whole API is meaningless without JWT, whereas Google is optional.
   *
   * No import cycle: `AppModule` imports this, this imports `AuthModule`, and `AuthModule`
   * imports neither.
   */
  static register(): DynamicModule {
    const config = readGoogleAuthConfig();

    if (!config) {
      return { module: GoogleAuthModule };
    }

    return {
      module: GoogleAuthModule,
      imports: [AuthModule],
      controllers: [GoogleAuthController],
      providers: [
        { provide: GOOGLE_AUTH_CONFIG, useValue: config },
        GoogleStrategy,
      ],
    };
  }
}
