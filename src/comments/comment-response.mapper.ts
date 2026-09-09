import { Injectable } from '@nestjs/common';
import { CommentRecord } from './comments.repository';
import { CommentResponse } from './interfaces/comment-response.interface';
import { FileStorageService } from '../file-storage/file-storage.service';

@Injectable()
export class CommentResponseMapper {
  constructor(private readonly fileStorage: FileStorageService) {}

  toResponse(comment: CommentRecord): CommentResponse {
    return {
      id: comment.id,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      body: comment.body,
      author: {
        username: comment.author.username,
        bio: comment.author.bio,
        image: this.fileStorage.publicUrl(comment.author.image),
        following: comment.author.followedBy.length > 0,
      },
    };
  }

  toResponseList(comments: CommentRecord[]): CommentResponse[] {
    return comments.map((comment) => this.toResponse(comment));
  }
}
