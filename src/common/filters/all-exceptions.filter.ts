import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { CustomLoggerService } from '../../logger/logger.service';

interface ExceptionResponse {
  statusCode: number;
  message: string;
  errors?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: CustomLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const response = this.handleException(exception);
    httpAdapter.reply(ctx.getResponse(), response, response.statusCode);
  }

  private handleException(exception: unknown): ExceptionResponse {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaException(exception);
    }

    if (exception instanceof Error) {
      return this.handleGenericError(exception);
    }

    return this.handleUnknownError(exception);
  }

  private handleHttpException(exception: HttpException): ExceptionResponse {
    const statusCode = exception.getStatus();
    const responseBody = exception.getResponse();

    if (typeof responseBody !== 'object' || responseBody === null) {
      return { statusCode, message: exception.message };
    }

    const data = responseBody as Record<string, unknown>;

    if (data.errors) {
      return {
        statusCode,
        message: (data.message as string) || 'Validation Error',
        errors: data.errors as Record<string, unknown>,
      };
    }

    if (Array.isArray(data.message)) {
      return {
        statusCode,
        message: 'Validation Error',
        errors: this.arrayToErrorObject(data.message),
      };
    }

    return {
      statusCode,
      message: (data.message as string) || exception.message,
    };
  }

  private handlePrismaException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ExceptionResponse {
    this.logger.error(`Prisma Error [${exception.code}]: ${exception.message}`);

    const PRISMA_UNIQUE_CONSTRAINT = 'P2002';
    const PRISMA_RECORD_NOT_FOUND = 'P2025';

    switch (exception.code) {
      case PRISMA_UNIQUE_CONSTRAINT:
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `Duplicate value for field: ${String(exception.meta?.target)}`,
        };

      case PRISMA_RECORD_NOT_FOUND:
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found in database',
        };

      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
        };
    }
  }

  private handleGenericError(exception: Error): ExceptionResponse {
    this.logger.error('System Error:', exception.stack);

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private handleUnknownError(exception: unknown): ExceptionResponse {
    this.logger.error('Unknown Error:', String(exception));

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private arrayToErrorObject(messages: unknown[]): Record<string, unknown> {
    return messages.reduce<Record<string, unknown>>((acc, curr, index) => {
      acc[`error_${index}`] = curr;
      return acc;
    }, {});
  }
}
