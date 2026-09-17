import { ApiProperty } from '@nestjs/swagger';

export class ProviderLinkConfirmedResponseDto {
  @ApiProperty({ example: true })
  confirmed: true;
}
