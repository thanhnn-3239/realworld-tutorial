import { DynamicModule, Global, Module, Scope } from '@nestjs/common';
import {
  CustomLoggerService,
  LOGGER_OPTIONS,
  LoggerOptions,
} from './logger.service';

@Global()
@Module({})
export class LoggerModule {
  static register(options: LoggerOptions = {}): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LOGGER_OPTIONS,
          useValue: options,
        },
        {
          provide: CustomLoggerService,
          useClass: CustomLoggerService,
          scope: Scope.TRANSIENT,
        },
      ],
      exports: [CustomLoggerService],
    };
  }
}
