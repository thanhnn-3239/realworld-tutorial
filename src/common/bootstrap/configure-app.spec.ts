import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TransformInterceptor } from '../interceptors/transform.interceptor';
import { configureApp } from './configure-app';

type AppMock = INestApplication & {
  enableVersioning: jest.Mock;
  useGlobalPipes: jest.Mock;
  useGlobalInterceptors: jest.Mock;
};

function createAppMock(): AppMock {
  return {
    get: jest.fn().mockReturnValue(new Reflector()),
    enableVersioning: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalInterceptors: jest.fn(),
  } as unknown as AppMock;
}

describe('configureApp', () => {
  it('bật URI versioning mặc định v1', () => {
    const app = createAppMock();

    configureApp(app);

    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
      prefix: 'v',
    });
  });

  it('đăng ký global ValidationPipe', () => {
    const app = createAppMock();

    configureApp(app);

    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes.mock.calls[0][0]).toBeInstanceOf(ValidationPipe);
  });

  it('đăng ký transform rồi tới serializer interceptor, đúng thứ tự', () => {
    const app = createAppMock();

    configureApp(app);

    const [first, second] = app.useGlobalInterceptors.mock.calls[0];
    expect(first).toBeInstanceOf(TransformInterceptor);
    expect(second).toBeInstanceOf(ClassSerializerInterceptor);
  });
});
