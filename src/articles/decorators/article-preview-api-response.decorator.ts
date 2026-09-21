import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { ArticlePreviewResponseDto } from '../dto/article-preview-response.dto';

export function ApiArticlePreviewResponse() {
  return applyDecorators(
    ApiExtraModels(ArticlePreviewResponseDto),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Article preview generated',
      schema: {
        type: 'object',
        required: ['statusCode', 'message', 'data'],
        properties: {
          statusCode: { type: 'integer', example: HttpStatus.OK },
          message: {
            type: 'string',
            example: 'Article preview generated successfully',
          },
          data: { $ref: getSchemaPath(ArticlePreviewResponseDto) },
        },
      },
    }),
  );
}
