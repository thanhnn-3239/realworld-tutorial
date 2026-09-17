import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth.service';
import { GoogleAuthController } from './google-auth.controller';

const IDENTITY = {
  provider: 'google',
  providerAccountId: 'google-subject',
  email: 'jane@example.com',
  emailVerified: true,
};

describe('GoogleAuthController callback', () => {
  const authService = { handleOAuthCallback: jest.fn() };
  const controller = new GoogleAuthController(
    authService as unknown as AuthService,
  );

  beforeEach(() => jest.clearAllMocks());

  function callback(response: { status: jest.Mock }) {
    return controller.callback(
      { user: IDENTITY } as unknown as Request,
      response as unknown as Response,
    );
  }

  it('keeps 200 and returns auth data for an authenticated result', async () => {
    const data = {
      email: IDENTITY.email,
      username: 'jane',
      bio: null,
      image: null,
      accessToken: 'access.jwt',
      refreshToken: 'refresh-token',
    };
    authService.handleOAuthCallback.mockResolvedValue({
      kind: 'authenticated',
      data,
    });
    const response = { status: jest.fn() };

    await expect(callback(response)).resolves.toBe(data);
    expect(response.status).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        GoogleAuthController.prototype.callback,
      ),
    ).toBe(HttpStatus.OK);
  });

  it('sets 202 and returns pending data when confirmation is required', async () => {
    const data = { status: 'confirmation_required' };
    authService.handleOAuthCallback.mockResolvedValue({
      kind: 'confirmation-required',
      data,
    });
    const response = { status: jest.fn() };

    await expect(callback(response)).resolves.toBe(data);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
  });
});
