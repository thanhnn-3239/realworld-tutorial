import { Controller } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import {
  CONTENT_PREVIEW_GRPC_ANALYZE_METHOD,
  CONTENT_PREVIEW_GRPC_SERVICE,
} from './content-preview.constants';
import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import type { ArticlePreview } from './content-preview-analyzer.service';

interface AnalyzeRequest {
  body: string;
}

@Controller()
export class ContentPreviewGrpcController {
  constructor(private readonly analyzer: ContentPreviewAnalyzerService) {}

  @GrpcMethod(CONTENT_PREVIEW_GRPC_SERVICE, CONTENT_PREVIEW_GRPC_ANALYZE_METHOD)
  analyze({ body }: AnalyzeRequest): ArticlePreview {
    if (!body.trim()) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Body must not be blank',
      });
    }

    return this.analyzer.analyze(body);
  }
}
