export interface ArticleCreatedEvent {
  articleId: number;
  slug: string;
  title: string;
  authorId: number;
  authorUsername: string;
  occurredAt: string;
}
