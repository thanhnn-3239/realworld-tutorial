import {
  buildPaginationMeta,
  paginationSkip,
} from './prisma.extension';

describe('paginationSkip', () => {
  it.each([
    [1, 10, 0],
    [2, 10, 10],
    [3, 25, 50],
    [1, 1, 0],
  ])('page %i with limit %i skips %i rows', (page, limit, expected) => {
    expect(paginationSkip(page, limit)).toBe(expected);
  });
});

describe('buildPaginationMeta', () => {
  it('reports a middle page as having neighbours on both sides', () => {
    expect(buildPaginationMeta(25, 2, 10)).toEqual({
      total: 25,
      page: 2,
      last_page: 3,
      limit: 10,
      has_next_page: true,
      has_prev_page: true,
    });
  });

  it('closes has_next_page on the last page', () => {
    expect(buildPaginationMeta(25, 3, 10)).toMatchObject({
      last_page: 3,
      has_next_page: false,
      has_prev_page: true,
    });
  });

  it('rounds a partial final page up', () => {
    expect(buildPaginationMeta(21, 1, 10)).toMatchObject({ last_page: 3 });
  });

  // An empty result set is not an error, so it must not produce a page that
  // claims to exist. Both flags stay false and last_page stays 0.
  it('reports an empty result set as zero pages', () => {
    expect(buildPaginationMeta(0, 1, 10)).toEqual({
      total: 0,
      page: 1,
      last_page: 0,
      limit: 10,
      has_next_page: false,
      has_prev_page: false,
    });
  });

  it('treats a page past the end as having no next page', () => {
    expect(buildPaginationMeta(5, 9, 10)).toMatchObject({
      last_page: 1,
      has_next_page: false,
      has_prev_page: true,
    });
  });

  it('gives every row its own page when limit is 1', () => {
    expect(buildPaginationMeta(3, 2, 1)).toMatchObject({
      last_page: 3,
      has_next_page: true,
      has_prev_page: true,
    });
  });
});
