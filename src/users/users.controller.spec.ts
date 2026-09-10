import { BadRequestException, HttpStatus, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import {
  UsersController,
  avatarFileFilter,
  ALLOWED_AVATAR_MIME_TYPES,
  USER_AVATAR_MAX_SIZE_BYTES,
} from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getCurrentUser: jest.Mock;
    updateUser: jest.Mock;
  };

  const user: AuthenticatedUser = { id: 1 };

  beforeEach(() => {
    usersService = {
      getCurrentUser: jest.fn(),
      updateUser: jest.fn(),
    };

    controller = new UsersController(usersService as unknown as UsersService);
  });

  describe('getCurrentUser', () => {
    it('delegates to usersService.getCurrentUser', async () => {
      const mockResult = {
        email: 'jake@jake.jake',
        username: 'jake',
        bio: null,
        image: null,
      };
      usersService.getCurrentUser.mockResolvedValue(mockResult);

      const result = await controller.getCurrentUser(user);

      expect(usersService.getCurrentUser).toHaveBeenCalledWith(1);
      expect(result).toBe(mockResult);
    });
  });

  describe('updateUser', () => {
    it('updates user profile without file upload', async () => {
      // `image` in the DTO only ever narrows to null (clear) or is absent (an
      // upload sets it instead), so this case exercises bio-only + null.
      const dto: UpdateUserDto = {
        bio: 'Updated bio',
        image: null,
      };
      const expectedResult = {
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'Updated bio',
        image: null,
      };
      usersService.updateUser.mockResolvedValue(expectedResult);

      const result = await controller.updateUser(user, dto);

      expect(usersService.updateUser).toHaveBeenCalledWith(1, dto, undefined);
      expect(result).toBe(expectedResult);
    });

    it('forwards the uploaded file to usersService.updateUser', async () => {
      const dto: UpdateUserDto = { bio: 'Bio with new avatar' };
      const mockFile = {
        fieldname: 'image',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-content'),
        size: 1024,
      } as Express.Multer.File;
      const updatedUser = {
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'Bio with new avatar',
        image: 'https://storage.example.com/uploads/User/1/random-uuid.png',
      };
      usersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(user, dto, mockFile);

      expect(usersService.updateUser).toHaveBeenCalledWith(1, dto, mockFile);
      expect(result).toBe(updatedUser);
    });
  });

  describe('avatarFileFilter', () => {
    it.each(ALLOWED_AVATAR_MIME_TYPES)(
      'accepts allowed mime type %s',
      (mimetype) => {
        const callback = jest.fn();
        avatarFileFilter(null, { mimetype }, callback);

        expect(callback).toHaveBeenCalledWith(null, true);
      },
    );

    it.each(['application/pdf', 'image/svg+xml', 'text/plain', 'image/tiff'])(
      'rejects disallowed mime type %s with BadRequestException',
      (mimetype) => {
        const callback = jest.fn();
        avatarFileFilter(null, { mimetype }, callback);

        expect(callback).toHaveBeenCalledWith(
          expect.any(BadRequestException),
          false,
        );
        const error = callback.mock.calls[0][0];
        expect(error.message).toBe('Unsupported file type');
      },
    );
  });

  describe('metadata & configuration', () => {
    it('defines max file size as 5MB', () => {
      expect(USER_AVATAR_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it('guards controller with JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, UsersController);
      expect(guards).toEqual([JwtAuthGuard]);
    });

    it('configures route paths and HTTP methods', () => {
      expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('user');
      expect(
        Reflect.getMetadata(
          METHOD_METADATA,
          UsersController.prototype.getCurrentUser,
        ),
      ).toBe(RequestMethod.GET);
      expect(
        Reflect.getMetadata(
          METHOD_METADATA,
          UsersController.prototype.updateUser,
        ),
      ).toBe(RequestMethod.PUT);
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          UsersController.prototype.getCurrentUser,
        ),
      ).toBe(HttpStatus.OK);
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          UsersController.prototype.updateUser,
        ),
      ).toBe(HttpStatus.OK);
    });

    it('attaches FileInterceptor to updateUser', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        UsersController.prototype.updateUser,
      );
      expect(interceptors).toBeDefined();
      expect(interceptors.length).toBeGreaterThan(0);
    });
  });
});
