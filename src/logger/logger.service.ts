import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import * as winston from 'winston';

export const LOGGER_OPTIONS = 'LOGGER_OPTIONS';

export interface LoggerOptions {
  fileName?: string;
}

@Injectable()
export class CustomLoggerService extends ConsoleLogger {
  private loggers: Map<string, winston.Logger> = new Map();
  private defaultFileName: string;
  private currentFileName: string | undefined;

  constructor(@Inject(LOGGER_OPTIONS) private loggerOptions: LoggerOptions) {
    super();
    this.defaultFileName = this.loggerOptions.fileName || 'nestjs.log';
  }

  setFile(fileName: string): void {
    this.currentFileName = fileName;
  }

  private getLogger(fileName: string): winston.Logger {
    if (this.loggers.has(fileName)) {
      return this.loggers.get(fileName)!;
    }

    const filePath = `logs/${fileName}`;
    const logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `[${timestamp}] [${level.toUpperCase()}] [${context || 'Application'}] ${message}`;
        }),
      ),
      transports: [new winston.transports.File({ filename: filePath })],
    });

    this.loggers.set(fileName, logger);
    return logger;
  }

  log(message: unknown, context?: string): void {
    super.log(message, context);
    this.writeToFile('info', message, context);
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    super.error(message, stackOrContext, context);
    const ctx = context || stackOrContext;
    this.writeToFile('error', message, ctx);
  }

  warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.writeToFile('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    super.debug(message, context);
    this.writeToFile('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    super.verbose(message, context);
    this.writeToFile('verbose', message, context);
  }

  logTo(fileName: string, level: string, message: unknown, context?: string): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const logger = this.getLogger(fileName);
    logger.log(level, msg, { context: context || this.context });
  }

  private writeToFile(
    level: string,
    message: unknown,
    context?: string,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const fileName = this.currentFileName || this.defaultFileName;
    this.getLogger(fileName).log(level, msg, { context: context || this.context });
  }
}
