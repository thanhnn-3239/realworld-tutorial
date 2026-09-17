import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GOOGLE_PROVIDER } from './google.strategy';

/**
 * Turns a failed code exchange into 401 rather than 500.
 *
 * An authorization code that is malformed, expired or already spent is a client condition —
 * a user pressing back, a stale bookmark, a tampered URL — so passport's `TokenError` must
 * not reach the generic error path, where it becomes a 500 and is logged as a system fault.
 *
 * Applied to the callback only. The route that starts the flow keeps the plain guard,
 * because there passport answers with a redirect and never reaches this hook.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard(GOOGLE_PROVIDER) {
  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Google sign-in could not be completed');
    }

    return user;
  }
}
