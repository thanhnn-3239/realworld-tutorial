import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

describe('CommentsController', () => {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new CommentsController(
    service as unknown as CommentsService,
  );
  const user = { id: 7, email: 'jake@example.com', username: 'jake' };

  beforeEach(() => jest.clearAllMocks());

  it('delegates list without a user', async () => {
    await controller.list(undefined, 'article-slug');

    expect(service.list).toHaveBeenCalledWith('article-slug', undefined);
  });

  it('delegates list with an authenticated user', async () => {
    await controller.list(user, 'article-slug');

    expect(service.list).toHaveBeenCalledWith('article-slug', 7);
  });

  it('delegates create with user, slug, and dto', async () => {
    const dto = { body: 'New comment' };

    await controller.create(user, 'article-slug', dto);

    expect(service.create).toHaveBeenCalledWith(7, 'article-slug', dto);
  });

  it('delegates remove with user, slug, and commentId', async () => {
    await controller.remove(user, 'article-slug', 42);

    expect(service.remove).toHaveBeenCalledWith(7, 'article-slug', 42);
  });

  it('configures OptionalJwtAuthGuard on list', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      CommentsController.prototype.list,
    );
    expect(guards).toEqual([OptionalJwtAuthGuard]);
  });

  it('configures JwtAuthGuard on create and remove', () => {
    const createGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      CommentsController.prototype.create,
    );
    expect(createGuards).toEqual([JwtAuthGuard]);

    const removeGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      CommentsController.prototype.remove,
    );
    expect(removeGuards).toEqual([JwtAuthGuard]);
  });
});
