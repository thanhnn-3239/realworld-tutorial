export interface ArticleNotificationJob {
  to: string;
  recipientUsername: string;
  subject: string;
  body: string;
  eventType: string;
  articleId: number;
  recipientId: number;
}
