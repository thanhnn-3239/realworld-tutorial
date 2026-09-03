import { CommentResponseMapper } from './comment-response.mapper';
import { CommentRecord } from './comments.repository';

const timestamp = new Date('2026-08-23T00:00:00.000Z');

// Base fixture: the viewer does not follow the author. The repository always
// selects followedBy, so anonymous reads arrive as an empty array, not as absent.
const baseComment = {
  id: 1,
  body: 'Great article!',
  createdAt: timestamp,
  updatedAt: timestamp,
  author: { username: 'jake', bio: null, image: null, followedBy: [] },
} satisfies CommentRecord;

describe('CommentResponseMapper', () => {
  const mapper = new CommentResponseMapper();

  it('returns following: false when author.followedBy is empty', () => {
    expect(mapper.toResponse(baseComment).author.following).toBe(false);
  });

  it('returns following: true when author.followedBy contains the viewer', () => {
    const comment = {
      ...baseComment,
      author: { ...baseComment.author, followedBy: [{ id: 1 }] },
    } satisfies CommentRecord;
    expect(mapper.toResponse(comment).author.following).toBe(true);
  });

  it('maps all stable fields correctly', () => {
    expect(mapper.toResponse(baseComment)).toEqual({
      id: 1,
      body: 'Great article!',
      createdAt: timestamp,
      updatedAt: timestamp,
      author: { username: 'jake', bio: null, image: null, following: false },
    });
  });

  it('maps a list preserving order and per-item shape', () => {
    const result = mapper.toResponseList([
      baseComment,
      { ...baseComment, id: 2, body: 'Second comment' },
    ]);
    expect(result.map((c) => c.id)).toEqual([1, 2]);
    expect(result[0]).toEqual(mapper.toResponse(baseComment));
  });

  it('maps an empty list to an empty list', () => {
    expect(mapper.toResponseList([])).toEqual([]);
  });
});
