import { Injectable } from '@nestjs/common';

export interface ArticlePreview {
  excerpt: string;
  wordCount: number;
  readingTimeMinutes: number;
}

@Injectable()
export class ContentPreviewAnalyzerService {
  analyze(body: string): ArticlePreview {
    const normalized = body.replace(/\s+/gu, ' ').trim();
    const wordCount = normalized ? normalized.split(' ').length : 0;

    return {
      excerpt: normalized.slice(0, 160),
      wordCount,
      readingTimeMinutes: Math.ceil(wordCount / 200),
    };
  }
}
