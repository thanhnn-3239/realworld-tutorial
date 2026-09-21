import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  CONTENT_PREVIEW_GRPC_ANALYZE_METHOD,
  CONTENT_PREVIEW_GRPC_SERVICE,
} from './content-preview.constants';
import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import type {
  AnalyzeRequest,
  ArticlePreview,
} from './interfaces/content-preview.interface';

@Controller()
export class ContentPreviewGrpcController {
  constructor(private readonly analyzer: ContentPreviewAnalyzerService) {}

  @GrpcMethod(CONTENT_PREVIEW_GRPC_SERVICE, CONTENT_PREVIEW_GRPC_ANALYZE_METHOD)
  analyze({ body }: AnalyzeRequest): ArticlePreview {
    return this.analyzer.analyze(body);
  }
}
