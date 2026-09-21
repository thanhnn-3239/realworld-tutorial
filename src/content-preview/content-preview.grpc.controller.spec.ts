import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';
import { ContentPreviewGrpcController } from './content-preview.grpc.controller';
import type { ArticlePreview } from './interfaces/content-preview.interface';

describe('ContentPreviewGrpcController', () => {
  const mockPreview: ArticlePreview = {
    excerpt: 'Sample preview',
    wordCount: 2,
    readingTimeMinutes: 1,
  };
  const analyzer = {
    analyze: jest.fn().mockReturnValue(mockPreview),
  } as unknown as ContentPreviewAnalyzerService;
  const controller = new ContentPreviewGrpcController(analyzer);

  it('delegates analyze call to ContentPreviewAnalyzerService', () => {
    const result = controller.analyze({ body: 'Sample preview' });

    expect(analyzer.analyze).toHaveBeenCalledWith('Sample preview');
    expect(result).toBe(mockPreview);
  });
});
