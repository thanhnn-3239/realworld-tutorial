import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateArticleDto } from './create-article.dto';

async function invalidProperties(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateArticleDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    stopAtFirstError: true,
  });
  return errors.map((error) => error.property).sort();
}

describe('CreateArticleDto', () => {
  it('accepts a valid payload without tagList', async () => {
    await expect(
      invalidProperties({
        title: 'Title',
        description: 'Description',
        body: 'Body',
      }),
    ).resolves.toEqual([]);
  });

  it.each(['title', 'description', 'body'])('requires %s', async (field) => {
    const payload: Record<string, unknown> = {
      title: 'Title',
      description: 'Description',
      body: 'Body',
    };
    delete payload[field];
    await expect(invalidProperties(payload)).resolves.toContain(field);
  });

  it.each(['title', 'description', 'body'])(
    'rejects whitespace-only %s',
    async (field) => {
      await expect(
        invalidProperties({
          title: 'Title',
          description: 'Description',
          body: 'Body',
          [field]: '   ',
        }),
      ).resolves.toContain(field);
    },
  );

  it('rejects non-string tag elements', async () => {
    await expect(
      invalidProperties({
        title: 'Title',
        description: 'Description',
        body: 'Body',
        tagList: ['nestjs', 7],
      }),
    ).resolves.toContain('tagList');
  });

  it('rejects a null tagList', async () => {
    await expect(
      invalidProperties({
        title: 'Title',
        description: 'Description',
        body: 'Body',
        tagList: null,
      }),
    ).resolves.toContain('tagList');
  });
});
