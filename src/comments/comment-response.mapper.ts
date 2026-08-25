import { Injectable } from '@nestjs/common';
import { CommentRecord } from './comments.repository';
import { CommentResponse } from './interfaces/comment-response.interface';

@Injectable()
export class CommentResponseMapper {
  toResponse(comment: CommentRecord): CommentResponse {
    return {
      id: comment.id,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      body: comment.body,
      author: {
        username: comment.author.username,
        bio: comment.author.bio,
        image: comment.author.image,
        following: false,
      },
    };
  }

  toResponseList(comments: CommentRecord[]): CommentResponse[] {
    return comments.map((comment) => this.toResponse(comment));
  }
}
