import { HttpStatus } from '@nestjs/common';
import { useE2eSuite } from './support/e2e-suite';

describe('Health (e2e)', () => {
  const e2e = useE2eSuite('health');

  it('serves /health without the v1 prefix', async () => {
    const response = await e2e.request.get('/health').expect(HttpStatus.OK);

    expect(response.body).toEqual({
      statusCode: HttpStatus.OK,
      message: 'Success',
      data: { status: 'ok' },
    });

    await e2e.request.get('/v1/health').expect(HttpStatus.NOT_FOUND);
  });
});
