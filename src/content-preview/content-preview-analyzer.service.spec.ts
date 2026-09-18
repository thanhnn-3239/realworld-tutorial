import { ContentPreviewAnalyzerService } from './content-preview-analyzer.service';

describe('ContentPreviewAnalyzerService', () => {
  const service = new ContentPreviewAnalyzerService();

  it('normalizes Unicode whitespace before calculating metadata', () => {
    expect(service.analyze('  NestJS\u00a0gRPC\npreview  ')).toEqual({
      excerpt: 'NestJS gRPC preview',
      wordCount: 3,
      readingTimeMinutes: 1,
    });
  });

  it('truncates the normalized excerpt at exactly 160 characters', () => {
    const body = `${'x'.repeat(159)}  y`;
    expect(service.analyze(body).excerpt).toHaveLength(160);
  });

  it('rounds reading time upward per 200 words', () => {
    expect(service.analyze('word '.repeat(201)).readingTimeMinutes).toBe(2);
  });
});
