import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ example: 'I work at statefarm', nullable: true })
  bio: string | null;

  @ApiProperty({
    example: 'https://api.realworld.io/images/smiley-cyrus.jpeg',
    nullable: true,
  })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}
