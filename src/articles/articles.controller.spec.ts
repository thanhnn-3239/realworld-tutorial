import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppModule } from '../app.module';
import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleSlugService } from './article-slug.service';
import { ArticlesController } from './articles.controller';
import { ArticlesModule } from './articles.module';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';

describe('ArticlesController', () => {
  const service = {
    create: jest.fn(),
    getBySlug: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    list: jest.fn(),
    feed: jest.fn(),
  };
  const controller = new ArticlesController(
    service as unknown as ArticlesService,
  );
  const user = { id: 7, email: 'jake@example.com', username: 'jake' };

  beforeEach(() => jest.clearAllMocks());

  it('delegates create with the JWT user id', async () => {
    const dto = { title: 'T', description: 'D', body: 'B' };

    await controller.create(user, dto);

    expect(service.create).toHaveBeenCalledWith(7, dto);
  });

  it('delegates get by slug without a user', async () => {
    await controller.getBySlug('article-slug');

    expect(service.getBySlug).toHaveBeenCalledWith('article-slug');
  });

  it('delegates update with the JWT user id and slug', async () => {
    const dto = { title: 'Updated' };

    await controller.update(user, 'article-slug', dto);

    expect(service.update).toHaveBeenCalledWith(7, 'article-slug', dto);
  });

  it('delegates remove with the JWT user id and slug', async () => {
    await controller.remove(user, 'article-slug');

    expect(service.remove).toHaveBeenCalledWith(7, 'article-slug');
  });

  it('delegates list with the whole query DTO', async () => {
    const query = { tag: 'dragons', page: 2, limit: 10 };

    await controller.list(query);

    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('delegates feed with the JWT user id and the pagination DTO', async () => {
    const query = { page: 2, limit: 10 };

    await controller.feed(user, query);

    expect(service.feed).toHaveBeenCalledWith(7, query);
  });

  // Nest matches routes in declaration order, so ':slug' declared first would
  // swallow '/articles/feed' and answer 404.
  it('declares feed before the slug route', () => {
    const methods = Object.getOwnPropertyNames(ArticlesController.prototype);

    expect(methods.indexOf('feed')).toBeGreaterThan(-1);
    expect(methods.indexOf('feed')).toBeLessThan(methods.indexOf('getBySlug'));
  });

  it('keeps list public and guards feed', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ArticlesController.prototype.list),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ArticlesController.prototype.feed),
    ).toContain(JwtAuthGuard);
  });

  it('declares the two read routes', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, ArticlesController.prototype.list),
    ).toBe('/');
    expect(
      Reflect.getMetadata(PATH_METADATA, ArticlesController.prototype.feed),
    ).toBe('feed');
    for (const method of ['list', 'feed'] as const) {
      expect(
        Reflect.getMetadata(
          METHOD_METADATA,
          ArticlesController.prototype[method],
        ),
      ).toBe(RequestMethod.GET);
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          ArticlesController.prototype[method],
        ),
      ).toBe(HttpStatus.OK);
    }
  });

  it('keeps GET public and protects mutating routes', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ArticlesController.prototype.getBySlug,
      ),
    ).toBeUndefined();

    for (const method of ['create', 'update', 'remove'] as const) {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          ArticlesController.prototype[method],
        ),
      ).toContain(JwtAuthGuard);
    }
  });

  it('declares the four article routes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ArticlesController)).toBe(
      'articles',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, ArticlesController.prototype.create),
    ).toBe('/');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        ArticlesController.prototype.getBySlug,
      ),
    ).toBe(':slug');
    expect(
      Reflect.getMetadata(PATH_METADATA, ArticlesController.prototype.update),
    ).toBe(':slug');
    expect(
      Reflect.getMetadata(PATH_METADATA, ArticlesController.prototype.remove),
    ).toBe(':slug');
    expect(
      Reflect.getMetadata(METHOD_METADATA, ArticlesController.prototype.create),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        ArticlesController.prototype.getBySlug,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(METHOD_METADATA, ArticlesController.prototype.update),
    ).toBe(RequestMethod.PUT);
    expect(
      Reflect.getMetadata(METHOD_METADATA, ArticlesController.prototype.remove),
    ).toBe(RequestMethod.DELETE);
  });

  it('declares the agreed success status codes', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        ArticlesController.prototype.create,
      ),
    ).toBe(HttpStatus.CREATED);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        ArticlesController.prototype.getBySlug,
      ),
    ).toBe(HttpStatus.OK);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        ArticlesController.prototype.update,
      ),
    ).toBe(HttpStatus.OK);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        ArticlesController.prototype.remove,
      ),
    ).toBe(HttpStatus.OK);
  });

  it('wires the articles module and registers it in the application module', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, ArticlesModule),
    ).toEqual(expect.arrayContaining([PrismaModule, AuthModule]));
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ArticlesModule),
    ).toContain(ArticlesController);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ArticlesModule),
    ).toEqual(
      expect.arrayContaining([
        ArticlesService,
        ArticlesRepository,
        ArticleSlugService,
        ArticleResponseMapper,
      ]),
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(
      ArticlesModule,
    );
  });
});
