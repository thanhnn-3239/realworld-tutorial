import { GrpcOptions, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import {
  CONTENT_PREVIEW_GRPC_DEFAULT_URL,
  CONTENT_PREVIEW_GRPC_PACKAGE,
} from './content-preview.constants';

export function createContentPreviewGrpcOptions(): GrpcOptions {
  return {
    transport: Transport.GRPC,
    options: {
      package: CONTENT_PREVIEW_GRPC_PACKAGE,
      protoPath: join(__dirname, 'content-preview.proto'),
      url:
        process.env.CONTENT_PREVIEW_GRPC_URL ??
        CONTENT_PREVIEW_GRPC_DEFAULT_URL,
    },
  };
}
