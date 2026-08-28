import { ApiProperty } from '@nestjs/swagger';
import {
  CommentAuthorResponse,
  CommentResponse,
} from '../interfaces/comment-response.interface';

export class CommentAuthorResponseDto implements CommentAuthorResponse {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ nullable: true, example: 'I work at statefarm' })
  bio: string | null;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.png' })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}

export class CommentResponseDto implements CommentResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ example: 'It takes a Jacobian' })
  body: string;

  @ApiProperty({ type: CommentAuthorResponseDto })
  author: CommentAuthorResponseDto;
}
