import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../prisma/prisma.extension';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  last_page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: true })
  has_next_page: boolean;

  @ApiProperty({ example: false })
  has_prev_page: boolean;
}
