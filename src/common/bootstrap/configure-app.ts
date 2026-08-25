import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TransformInterceptor } from '../interceptors/transform.interceptor';
import validationOptions from '../validation/validation-options';

/**
 * Shared by `main.ts` and the e2e harness, so a new global pipe, interceptor or
 * versioning change reaches the tests instead of silently drifting away from
 * production.
 *
 * Process-level concerns — shutdown hooks, logger, Swagger, listen — stay in
 * `main.ts`: the tests boot through `app.init()` and never open a port.
 */
export function configureApp(app: INestApplication): void {
  const reflector = app.get(Reflector);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(
    new TransformInterceptor(reflector),
    new ClassSerializerInterceptor(reflector),
  );
}
