import {
  buildArticleFilter,
  hasEffectiveUpdate,
  normalizeTag,
  normalizeTags,
} from './articles.helper';

describe('articles.helper', () => {
  describe('normalizeTag', () => {
    it('trims and lowercases tags', () => {
      expect(normalizeTag('  NestJS  ')).toBe('nestjs');
    });
  });

  describe('normalizeTags', () => {
    it('normalizes, removes empty strings, and deduplicates', () => {
      expect(
        normalizeTags([' NestJS ', 'nestjs', '', '   ', 'PRISMA']),
      ).toEqual(['nestjs', 'prisma']);
    });
  });

  describe('hasEffectiveUpdate', () => {
    it('returns true if any field is provided', () => {
      expect(hasEffectiveUpdate({ title: 'New' })).toBe(true);
      expect(hasEffectiveUpdate({ description: 'New' })).toBe(true);
      expect(hasEffectiveUpdate({ body: 'New' })).toBe(true);
      expect(hasEffectiveUpdate({ tagList: ['tag'] })).toBe(true);
    });

    it('returns false if all fields are undefined', () => {
      expect(hasEffectiveUpdate({})).toBe(false);
    });
  });

  describe('buildArticleFilter', () => {
    it('builds filter with normalized tag, author, and favorited', () => {
      expect(
        buildArticleFilter({
          tag: '  NestJS  ',
          author: 'john',
          favorited: 'jane',
        }),
      ).toEqual({
        tag: 'nestjs',
        author: 'john',
        favorited: 'jane',
      });
    });

    it('omits undefined fields', () => {
      expect(buildArticleFilter({})).toEqual({});
    });
  });
});
