import { ApiProperty } from '@nestjs/swagger';

/**
 * The refresh response. Narrower than `AuthResponseDto` on purpose: rotating a token says
 * nothing new about the profile, so it returns no profile fields.
 */
export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU' })
  refreshToken: string;
}
