import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Extracts the authenticated user from the request without throwing
 * when the user is absent (used behind OptionalJwtAuthGuard).
 * Returns `undefined` for unauthenticated requests.
 */
export const OptionalCurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedUser
    | AuthenticatedUser[keyof AuthenticatedUser]
    | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
