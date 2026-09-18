export interface ArticleFavoritedEvent {
  articleId: number;
  slug: string;
  title: string;
  authorId: number;
  favoritedByUserId: number;
  favoritedByUsername: string;
  occurredAt: string;
}
