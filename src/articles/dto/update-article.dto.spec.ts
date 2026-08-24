import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateArticleDto } from './update-article.dto';

async function invalidProperties(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateArticleDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    stopAtFirstError: true,
  });
  return errors.map((error) => error.property).sort();
}

describe('UpdateArticleDto', () => {
  it('allows an empty DTO for service-level effective-update validation', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
  });

  it.each(['title', 'description', 'body'])(
    'accepts an individual valid %s field',
    async (field) => {
      await expect(invalidProperties({ [field]: 'value' })).resolves.toEqual(
        [],
      );
    },
  );

  it.each(['title', 'description', 'body'])(
    'rejects whitespace-only %s',
    async (field) => {
      await expect(invalidProperties({ [field]: '   ' })).resolves.toContain(
        field,
      );
    },
  );

  it('accepts tagList: []', async () => {
    await expect(invalidProperties({ tagList: [] })).resolves.toEqual([]);
  });

  it('rejects null and non-string tag elements', async () => {
    await expect(
      invalidProperties({ tagList: ['nestjs', null] }),
    ).resolves.toContain('tagList');
  });
});
