import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { CustomLoggerService } from './../../logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal Server Error' };

    let errorMessage =
      (exceptionResponse as any).message || 'Internal Server Error';
    let errorName = (exceptionResponse as any).error || 'Internal Server Error';
    let errors = null;

    // Handle Validation Errors (UnprocessableEntity)
    if (
      httpStatus === HttpStatus.UNPROCESSABLE_ENTITY &&
      (exceptionResponse as any).errors
    ) {
      errors = (exceptionResponse as any).errors;
      errorMessage = 'Validation Failed';
    }

    // Handle generic object responses that might contain error info
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ((exceptionResponse as any).message) {
        if (Array.isArray((exceptionResponse as any).message)) {
          errorMessage = (exceptionResponse as any).message[0];
        } else {
          errorMessage = (exceptionResponse as any).message;
        }
      }
    }

    if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    // Normalize simple boolean/string messages
    if (typeof errorMessage !== 'string') {
      errorMessage = JSON.stringify(errorMessage);
    }

    const responseBody = {
      statusCode: httpStatus,
      message: errorMessage,
      error: errorName,
      ...(errors ? { errors } : {}),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
