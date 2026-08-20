import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'I love programming', nullable: true })
  bio: string | null;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  image: string | null;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  constructor(partial: Partial<AuthResponseDto>) {
    Object.assign(this, partial);
  }
}
