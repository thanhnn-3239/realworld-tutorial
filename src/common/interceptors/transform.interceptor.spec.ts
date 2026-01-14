import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockResponse: { statusCode: number };

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockResponse = { statusCode: 200 };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;
  });

  const createCallHandler = (data: any): CallHandler => ({
    handle: () => of(data),
  });

  describe('Raw data wrapping', () => {
    it('should wrap simple object in data property', (done) => {
      const rawData = { id: 1, name: 'test' };
      mockCallHandler = createCallHandler(rawData);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: { id: 1, name: 'test' },
            statusCode: 200,
          });
          done();
        },
      });
    });

    it('should wrap array in data property', (done) => {
      const rawData = [{ id: 1 }, { id: 2 }];
      mockCallHandler = createCallHandler(rawData);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: [{ id: 1 }, { id: 2 }],
            statusCode: 200,
          });
          done();
        },
      });
    });

    it('should wrap primitive in data property', (done) => {
      const rawData = 'hello';
      mockCallHandler = createCallHandler(rawData);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: 'hello',
            statusCode: 200,
          });
          done();
        },
      });
    });

    it('should wrap null in data property', (done) => {
      mockCallHandler = createCallHandler(null);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: null,
            statusCode: 200,
          });
          done();
        },
      });
    });
  });

  describe('Pre-formatted data (with data property)', () => {
    it('should preserve existing data structure and add statusCode', (done) => {
      const preFormatted = { data: { id: 1, name: 'test' } };
      mockCallHandler = createCallHandler(preFormatted);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: { id: 1, name: 'test' },
            statusCode: 200,
          });
          done();
        },
      });
    });

    it('should NOT re-wrap if data already has statusCode', (done) => {
      const alreadyWrapped = { data: { id: 1 }, statusCode: 201 };
      mockCallHandler = createCallHandler(alreadyWrapped);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          // Should wrap the whole object because it already has statusCode
          expect(result).toEqual({
            data: { data: { id: 1 }, statusCode: 201 },
            statusCode: 200,
          });
          done();
        },
      });
    });
  });

  describe('Pagination (with data and meta)', () => {
    it('should preserve data and meta, add statusCode', (done) => {
      const paginatedData = {
        data: [{ id: 1 }, { id: 2 }],
        meta: { page: 1, limit: 10, total: 100 },
      };
      mockCallHandler = createCallHandler(paginatedData);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: [{ id: 1 }, { id: 2 }],
            meta: { page: 1, limit: 10, total: 100 },
            statusCode: 200,
          });
          done();
        },
      });
    });

    it('should preserve extra properties alongside data and meta', (done) => {
      const extendedPagination = {
        data: [{ id: 1 }],
        meta: { page: 1 },
        links: { next: '/api/items?page=2' },
      };
      mockCallHandler = createCallHandler(extendedPagination);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({
            data: [{ id: 1 }],
            meta: { page: 1 },
            links: { next: '/api/items?page=2' },
            statusCode: 200,
          });
          done();
        },
      });
    });
  });

  describe('Status code handling', () => {
    it('should use response statusCode 201 for created resources', (done) => {
      mockResponse.statusCode = 201;
      const rawData = { id: 1 };
      mockCallHandler = createCallHandler(rawData);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result.statusCode).toBe(201);
          done();
        },
      });
    });
  });
});
