import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import {
  MAX_EXCERPT_LENGTH,
  WORDS_PER_MINUTE,
} from './content-preview.constants';

describe('ContentPreviewAnalyzerService', () => {
  const service = new ContentPreviewAnalyzerService();

  it.each(['', '   ', ' \t\n'])(
    'rejects a blank body with INVALID_ARGUMENT',
    (body) => {
      try {
        service.analyze(body);
        fail('Expected analyze to throw RpcException');
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect((error as RpcException).getError()).toEqual({
          code: status.INVALID_ARGUMENT,
          message: 'Body must not be blank',
        });
      }
    },
  );

  it('normalizes Unicode whitespace before calculating metadata', () => {
    expect(service.analyze('  NestJS\u00a0gRPC\npreview  ')).toEqual({
      excerpt: 'NestJS gRPC preview',
      wordCount: 3,
      readingTimeMinutes: 1,
    });
  });

  it(`truncates the normalized excerpt at exactly ${MAX_EXCERPT_LENGTH} characters`, () => {
    const body = `${'x'.repeat(MAX_EXCERPT_LENGTH - 1)}  y`;
    expect(service.analyze(body).excerpt).toHaveLength(MAX_EXCERPT_LENGTH);
  });

  it(`rounds reading time upward per ${WORDS_PER_MINUTE} words`, () => {
    expect(
      service.analyze('word '.repeat(WORDS_PER_MINUTE + 1)).readingTimeMinutes,
    ).toBe(2);
  });
});
