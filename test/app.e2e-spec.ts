import { useE2eSuite } from './support/e2e-suite';

// Matched as a shape because the greeting embeds a live row count: a literal
// would pin the assertion to whatever data the target database happens to hold.
const GREETING = /^Hello! Welcome to RealWorld API - Users: \d+$/;

describe('AppController (e2e)', () => {
  const e2e = useE2eSuite('app-smoke');

  it('/v1 (GET)', async () => {
    const response = await e2e.request.get('/v1').expect(200);

    expect(response.body).toMatchObject({
      statusCode: 200,
      message: 'Success',
      data: expect.stringMatching(GREETING),
    });
  });
});
