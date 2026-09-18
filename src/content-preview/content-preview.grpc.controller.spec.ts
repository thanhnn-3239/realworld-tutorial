import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import { ContentPreviewGrpcController } from './content-preview.grpc.controller';

describe('ContentPreviewGrpcController', () => {
  const analyzer = {
    analyze: jest.fn(),
  } as unknown as ContentPreviewAnalyzerService;
  const controller = new ContentPreviewGrpcController(analyzer);

  it.each(['', ' \t\n'])(
    'rejects a blank body with INVALID_ARGUMENT',
    (body) => {
      try {
        controller.analyze({ body });
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
});
