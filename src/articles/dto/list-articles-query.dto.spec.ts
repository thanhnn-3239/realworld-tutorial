import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListArticlesQueryDto } from './list-articles-query.dto';

async function invalidProperties(payload: Record<string, unknown>) {
  const dto = plainToInstance(ListArticlesQueryDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    stopAtFirstError: true,
  });
  return errors.map((error) => error.property).sort();
}

function instantiate(payload: Record<string, unknown>) {
  return plainToInstance(ListArticlesQueryDto, payload);
}

describe('ListArticlesQueryDto', () => {
  it('accepts an empty query and applies the agreed defaults', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
    expect(instantiate({})).toMatchObject({ page: 1, limit: 10 });
  });

  it('coerces page and limit from their query-string form', () => {
    expect(instantiate({ page: '3', limit: '25' })).toMatchObject({
      page: 3,
      limit: 25,
    });
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', 'abc'],
    ['limit', '0'],
    ['limit', '101'],
  ])('rejects %s=%s', async (field, value) => {
    await expect(invalidProperties({ [field]: value })).resolves.toContain(field);
  });

  it('accepts limit at the upper bound', async () => {
    await expect(invalidProperties({ limit: '100' })).resolves.toEqual([]);
  });

  it.each(['tag', 'author', 'favorited'])(
    'accepts %s as a single string',
    async (field) => {
      await expect(invalidProperties({ [field]: 'jake' })).resolves.toEqual([]);
    },
  );

  // Express turns a repeated query parameter into an array, which must not
  // reach the where clause.
  it.each(['tag', 'author', 'favorited'])(
    'rejects a repeated %s parameter',
    async (field) => {
      await expect(
        invalidProperties({ [field]: ['a', 'b'] }),
      ).resolves.toContain(field);
    },
  );
});
