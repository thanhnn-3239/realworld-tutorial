import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import {
  CONTENT_PREVIEW_GRPC_DEADLINE_MS,
  CONTENT_PREVIEW_GRPC_SERVICE,
} from '../content-preview/content-preview.constants';
import type { ArticlePreview } from '../content-preview/interfaces/content-preview.interface';
import { ArticlePreviewClientService } from './article-preview-client.service';

describe('ArticlePreviewClientService', () => {
  const preview: ArticlePreview = {
    excerpt: 'Draft preview',
    wordCount: 2,
    readingTimeMinutes: 1,
  };

  let grpcAnalyze: jest.Mock;
  let loggerWarn: jest.SpiedFunction<Logger['warn']>;
  let service: ArticlePreviewClientService;

  beforeEach(() => {
    grpcAnalyze = jest.fn();
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const client = {
      getService: jest.fn((serviceName: string) => {
        if (serviceName === CONTENT_PREVIEW_GRPC_SERVICE) {
          return { analyze: grpcAnalyze };
        }

        throw new Error(`Unexpected gRPC service: ${serviceName}`);
      }),
    };
    service = new ArticlePreviewClientService(client as unknown as ClientGrpc);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns the unary gRPC response', async () => {
    grpcAnalyze.mockReturnValue(of(preview));

    await expect(service.analyze('Draft')).resolves.toEqual(preview);
  });

  it('maps an unavailable gRPC response to a generic 503', async () => {
    grpcAnalyze.mockReturnValue(
      throwError(() => ({ code: status.UNAVAILABLE })),
    );

    const error = await service
      .analyze('Draft')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error).toMatchObject({ message: 'Article preview is unavailable' });
  });

  it('maps a deadline expiry to a generic 503', async () => {
    jest.useFakeTimers();
    grpcAnalyze.mockReturnValue(NEVER);

    const response = service
      .analyze('Draft')
      .catch((caught: unknown) => caught);
    await jest.advanceTimersByTimeAsync(CONTENT_PREVIEW_GRPC_DEADLINE_MS);

    const error = await response;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error).toMatchObject({
      message: 'Article preview is unavailable',
    });
  });

  it('does not log a malformed upstream code', async () => {
    grpcAnalyze.mockReturnValue(
      throwError(() => ({ code: 'request body content' })),
    );

    await service.analyze('Draft').catch(() => undefined);

    expect(loggerWarn).toHaveBeenCalledWith(
      'Article preview unavailable operation=Analyze code=UNKNOWN',
    );
    expect(loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('request body content'),
    );
  });
});
