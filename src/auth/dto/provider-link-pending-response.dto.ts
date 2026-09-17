import { ApiProperty } from '@nestjs/swagger';

export class ProviderLinkPendingResponseDto {
  @ApiProperty({ example: 'confirmation_required' })
  status: 'confirmation_required';
}
