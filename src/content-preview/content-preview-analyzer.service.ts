import { Injectable } from '@nestjs/common';
import {
  MAX_EXCERPT_LENGTH,
  WORDS_PER_MINUTE,
} from './content-preview.constants';

export { MAX_EXCERPT_LENGTH, WORDS_PER_MINUTE };

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
      excerpt: normalized.slice(0, MAX_EXCERPT_LENGTH),
      wordCount,
      readingTimeMinutes: Math.ceil(wordCount / WORDS_PER_MINUTE),
    };
  }
}
