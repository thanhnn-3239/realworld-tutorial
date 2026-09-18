import { EmailJobRegistry } from './email-job.registry';
import { EmailJobHandler } from './interfaces/email-job-handler.interface';

describe('EmailJobRegistry', () => {
  let registry: EmailJobRegistry;

  beforeEach(() => {
    registry = new EmailJobRegistry();
  });

  it('registers and retrieves handler by jobName', () => {
    const handler: EmailJobHandler = {
      jobName: 'test-job',
      handle: jest.fn(),
    };

    registry.register(handler);
    expect(registry.get('test-job')).toBe(handler);
  });

  it('returns undefined for unregistered jobName', () => {
    expect(registry.get('unregistered')).toBeUndefined();
  });
});
