export const USER_ID = 7;

export const notFavorited = {
  id: 1,
  slug: 'hello',
  title: 'Hello',
  authorId: 42,
  favoritedBy: [],
};

export const favorited = {
  id: 1,
  slug: 'hello',
  title: 'Hello',
  authorId: 42,
  favoritedBy: [{ id: USER_ID }],
};
