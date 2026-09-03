import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT guard that does NOT reject unauthenticated requests.
 * When no token is present or the token is invalid, the request
 * continues with `request.user = undefined`.
 * Use this on public endpoints that return richer data when authenticated.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: any, user: TUser): TUser {
    // Suppress both token errors and missing-token cases.
    // Returns JwtPayload when authenticated, undefined otherwise.
    return user;
  }
}
