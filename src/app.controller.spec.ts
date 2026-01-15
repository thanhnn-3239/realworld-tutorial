import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Test User' }]),
    },
  })),
}));

jest.mock('./logger/logger.service', () => ({
  CustomLoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
  })),
}));

jest.mock('nestjs-i18n', () => ({
  I18nService: jest.fn().mockImplementation(() => ({
    t: jest.fn().mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        'common.hello': 'Hello',
        'common.welcome': 'Welcome',
      };
      return translations[key] || key;
    }),
  })),
}));

import { PrismaService } from './prisma/prisma.service';
import { CustomLoggerService } from './logger/logger.service';
import { I18nService } from 'nestjs-i18n';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useClass: PrismaService },
        { provide: CustomLoggerService, useClass: CustomLoggerService },
        { provide: I18nService, useClass: I18nService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return greeting with user count', async () => {
      const result = await appController.getHello();
      expect(result).toBe('Hello! Welcome - Users: 1');
    });
  });
});
