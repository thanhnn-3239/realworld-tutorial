import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { CONTENT_PREVIEW_GRPC_CLIENT } from './content-preview.constants';
import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import { createContentPreviewGrpcOptions } from './content-preview-grpc.config';
import { ContentPreviewGrpcController } from './content-preview.grpc.controller';
import { ArticlePreviewClientService } from '../articles/article-preview-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: CONTENT_PREVIEW_GRPC_CLIENT,
        useFactory: createContentPreviewGrpcOptions,
      },
    ]),
  ],
  controllers: [ContentPreviewGrpcController],
  providers: [ContentPreviewAnalyzerService, ArticlePreviewClientService],
  exports: [ClientsModule, ArticlePreviewClientService],
})
export class ContentPreviewModule {}
