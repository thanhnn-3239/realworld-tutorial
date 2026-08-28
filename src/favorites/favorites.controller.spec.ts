import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  const service = {
    favorite: jest.fn(),
    unfavorite: jest.fn(),
  };
  const controller = new FavoritesController(
    service as unknown as FavoritesService,
  );
  const user = { id: 7, email: 'jake@example.com', username: 'jake' };

  beforeEach(() => jest.clearAllMocks());

  it('delegates favorite with the acting user and slug', async () => {
    await controller.favorite(user, 'article-slug');

    expect(service.favorite).toHaveBeenCalledWith(7, 'article-slug');
  });

  it('delegates unfavorite with the acting user and slug', async () => {
    await controller.unfavorite(user, 'article-slug');

    expect(service.unfavorite).toHaveBeenCalledWith(7, 'article-slug');
  });

  it('configures JwtAuthGuard on favorite and unfavorite', () => {
    const favoriteGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      FavoritesController.prototype.favorite,
    );
    expect(favoriteGuards).toEqual([JwtAuthGuard]);

    const unfavoriteGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      FavoritesController.prototype.unfavorite,
    );
    expect(unfavoriteGuards).toEqual([JwtAuthGuard]);
  });
});
