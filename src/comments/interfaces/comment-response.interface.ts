export interface CommentAuthorResponse {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface CommentResponse {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  body: string;
  author: CommentAuthorResponse;
}
