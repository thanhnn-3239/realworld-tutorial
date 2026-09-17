import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { VerifiedIdentity } from '../../src/auth/providers/verified-identity.interface';

const FAILURE_MESSAGE = 'Google sign-in could not be completed';

function singleHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

@Injectable()
export class GoogleAuthGuardStub implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('GoogleAuthGuardStub is test-only');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providerAccountId = singleHeader(request, 'x-test-google-sub');
    const email = singleHeader(request, 'x-test-google-email');
    const verified = singleHeader(request, 'x-test-google-email-verified');

    if (
      !providerAccountId ||
      !email ||
      !['true', 'false'].includes(verified!)
    ) {
      throw new UnauthorizedException(FAILURE_MESSAGE);
    }

    request.user = {
      provider: 'google',
      providerAccountId,
      email,
      emailVerified: verified === 'true',
    } satisfies VerifiedIdentity;

    return true;
  }
}
