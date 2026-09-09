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

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Bearer token for the Authorization header. Valid for 15 minutes.',
  })
  accessToken: string;

  @ApiProperty({
    example: 'q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU',
    description:
      'Opaque token for POST /auth/refresh. Single-use: refreshing rotates it, and presenting a spent one revokes every session.',
  })
  refreshToken: string;

  constructor(partial: Partial<AuthResponseDto>) {
    Object.assign(this, partial);
  }
}
