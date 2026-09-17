import { CommentResponseMapper } from './comment-response.mapper';
import { CommentRecord } from './comments.repository';
import { FileStorageService } from '../file-storage/file-storage.service';

const timestamp = new Date('2026-08-23T00:00:00.000Z');

const fileStorage = {
  publicUrl: jest.fn((key: string | null) =>
    key === null ? null : `https://cdn.test/${key}`,
  ),
} as unknown as FileStorageService;

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
  const mapper = new CommentResponseMapper(fileStorage);

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

  it('returns the author avatar as a URL, not the stored key', () => {
    const comment = {
      ...baseComment,
      author: {
        ...baseComment.author,
        image: 'public/uploads/User/7/a.png',
      },
    } satisfies CommentRecord;

    expect(mapper.toResponse(comment).author.image).toBe(
      'https://cdn.test/public/uploads/User/7/a.png',
    );
  });
});
