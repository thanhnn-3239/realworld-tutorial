import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CONTENT_PREVIEW_GRPC_CLIENT,
  CONTENT_PREVIEW_GRPC_DEADLINE_MS,
  CONTENT_PREVIEW_GRPC_SERVICE,
} from '../content-preview/content-preview.constants';
import type {
  ArticlePreview,
  ContentPreviewGrpcService,
} from '../content-preview/interfaces/content-preview.interface';

@Injectable()
export class ArticlePreviewClientService implements OnModuleInit {
  private readonly logger = new Logger(ArticlePreviewClientService.name);
  private contentPreviewService!: ContentPreviewGrpcService;

  constructor(
    @Inject(CONTENT_PREVIEW_GRPC_CLIENT)
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.contentPreviewService =
      this.client.getService<ContentPreviewGrpcService>(
        CONTENT_PREVIEW_GRPC_SERVICE,
      );
  }

  async analyze(body: string): Promise<ArticlePreview> {
    try {
      return await firstValueFrom(
        this.contentPreviewService
          .analyze({ body })
          .pipe(timeout({ first: CONTENT_PREVIEW_GRPC_DEADLINE_MS })),
      );
    } catch (error) {
      this.logger.warn(
        `Article preview unavailable operation=Analyze code=${this.errorCode(error)}`,
      );
      throw new ServiceUnavailableException('Article preview is unavailable');
    }
  }

  private errorCode(error: unknown): number | 'UNKNOWN' {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const { code } = error as { code?: unknown };
      if (
        typeof code === 'number' &&
        Number.isInteger(code) &&
        Object.values(status).includes(code)
      ) {
        return code;
      }
    }

    return 'UNKNOWN';
  }
}
