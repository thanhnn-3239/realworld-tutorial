import type { Observable } from 'rxjs';

export interface ArticlePreview {
  excerpt: string;
  wordCount: number;
  readingTimeMinutes: number;
}

export interface AnalyzeRequest {
  body: string;
}

export interface ContentPreviewGrpcService {
  analyze(request: AnalyzeRequest): Observable<ArticlePreview>;
}
