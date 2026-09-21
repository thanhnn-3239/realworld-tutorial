import { Injectable } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import {
  MAX_EXCERPT_LENGTH,
  WORDS_PER_MINUTE,
} from './content-preview.constants';
import type { ArticlePreview } from './interfaces/content-preview.interface';

@Injectable()
export class ContentPreviewAnalyzerService {
  analyze(body: string): ArticlePreview {
    if (!body || !body.trim()) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Body must not be blank',
      });
    }

    const normalized = body.replace(/\s+/gu, ' ').trim();
    const wordCount = normalized ? normalized.split(' ').length : 0;

    return {
      excerpt: normalized.slice(0, MAX_EXCERPT_LENGTH),
      wordCount,
      readingTimeMinutes: Math.ceil(wordCount / WORDS_PER_MINUTE),
    };
  }
}
