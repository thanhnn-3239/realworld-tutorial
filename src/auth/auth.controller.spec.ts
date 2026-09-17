import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController provider link confirmation', () => {
  const authService = {
    confirmGoogleLink: jest.fn().mockResolvedValue({ confirmed: true }),
  };
  const controller = new AuthController(authService as unknown as AuthService);

  beforeEach(() => jest.clearAllMocks());

  it('delegates the raw token and returns a token-free confirmation', async () => {
    const dto = { token: 'a'.repeat(43) };

    await expect(controller.confirmGoogleLink(dto)).resolves.toEqual({
      confirmed: true,
    });
    expect(authService.confirmGoogleLink).toHaveBeenCalledWith(dto);
  });

  it('registers POST auth/google/link/confirm with HTTP 200', () => {
    const method = AuthController.prototype.confirmGoogleLink;

    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(
      'google/link/confirm',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, method)).toBe(HttpStatus.OK);
  });
});
