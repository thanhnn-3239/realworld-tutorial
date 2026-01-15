import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { CustomLoggerService } from '../../logger/logger.service';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockHttpAdapterHost: HttpAdapterHost;
  let mockLogger: jest.Mocked<CustomLoggerService>;
  let mockReply: jest.Mock;
  let mockArgumentsHost: any;

  beforeEach(() => {
    mockReply = jest.fn();

    mockHttpAdapterHost = {
      httpAdapter: {
        reply: mockReply,
      },
    } as unknown as HttpAdapterHost;

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<CustomLoggerService>;

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue({}),
        getRequest: jest.fn().mockReturnValue({}),
      }),
    };

    filter = new AllExceptionsFilter(mockHttpAdapterHost, mockLogger);
  });

  describe('HttpException handling', () => {
    it('should handle basic HttpException with string message', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Not Found',
        },
        HttpStatus.NOT_FOUND,
      );
    });

    it('should handle BadRequestException with object response', () => {
      const exception = new BadRequestException({
        message: 'Invalid input',
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid input',
        },
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle NotFoundException', () => {
      const exception = new NotFoundException('User not found');

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'User not found',
        },
        HttpStatus.NOT_FOUND,
      );
    });

    it('should handle validation errors with explicit errors object', () => {
      const exception = new UnprocessableEntityException({
        message: 'Validation failed',
        errors: {
          email: 'Invalid email format',
          password: 'Password too short',
        },
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation failed',
          errors: {
            email: 'Invalid email format',
            password: 'Password too short',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    it('should handle validation errors with message array (ValidationPipe)', () => {
      const exception = new BadRequestException({
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation Error',
          errors: {
            error_0: 'email must be an email',
            error_1: 'password is too short',
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    });

    it('should handle HttpException with null response body', () => {
      const exception = new HttpException(null as any, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Http Exception',
        },
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('Prisma exception handling', () => {
    it('should handle P2002 unique constraint violation', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('P2002'),
      );
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Duplicate value for field: email',
        },
        HttpStatus.CONFLICT,
      );
    });

    it('should handle P2025 record not found', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found in database',
        },
        HttpStatus.NOT_FOUND,
      );
    });

    it('should handle unknown Prisma error codes', () => {
      const exception = new Prisma.PrismaClientKnownRequestError(
        'Unknown error',
        {
          code: 'P9999',
          clientVersion: '5.0.0',
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('Generic Error handling', () => {
    it('should handle generic Error and log stack trace', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'System Error:',
        expect.any(String),
      );
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('Unknown exception handling', () => {
    it('should handle string thrown as exception', () => {
      filter.catch('Something unexpected', mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unknown Error:',
        'Something unexpected',
      );
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle number thrown as exception', () => {
      filter.catch(42, mockArgumentsHost);

      expect(mockLogger.error).toHaveBeenCalledWith('Unknown Error:', '42');
      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle undefined thrown as exception', () => {
      filter.catch(undefined, mockArgumentsHost);

      expect(mockReply).toHaveBeenCalledWith(
        expect.anything(),
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('Response structure', () => {
    it('should always include statusCode and message', () => {
      const exception = new HttpException('Test', HttpStatus.OK);

      filter.catch(exception, mockArgumentsHost);

      const responseBody = mockReply.mock.calls[0][1];
      expect(responseBody).toHaveProperty('statusCode');
      expect(responseBody).toHaveProperty('message');
    });

    it('should only include errors when validation fails', () => {
      const exception = new HttpException('Test', HttpStatus.OK);

      filter.catch(exception, mockArgumentsHost);

      const responseBody = mockReply.mock.calls[0][1];
      expect(responseBody).not.toHaveProperty('errors');
    });
  });
});
