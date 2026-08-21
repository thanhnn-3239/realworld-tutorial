import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PasswordService } from './password.service';

function buildService(saltRounds?: string): PasswordService {
  const configService = {
    get: jest.fn((_key: string, defaultValue?: string) =>
      saltRounds === undefined ? defaultValue : saltRounds,
    ),
  } as unknown as ConfigService;

  return new PasswordService(configService);
}

describe('PasswordService', () => {
  describe('hash', () => {
    it('never returns the plaintext it was given', async () => {
      const service = buildService('4');

      const hash = await service.hash('password123');

      expect(hash).not.toBe('password123');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('produces a hash that verifies against the original password', async () => {
      const service = buildService('4');

      const hash = await service.hash('password123');

      await expect(bcrypt.compare('password123', hash)).resolves.toBe(true);
    });

    it('produces a different hash each call (unique salts)', async () => {
      const service = buildService('4');

      const [first, second] = await Promise.all([
        service.hash('password123'),
        service.hash('password123'),
      ]);

      expect(first).not.toBe(second);
    });

    it('applies the configured salt rounds', async () => {
      const hash = await buildService('5').hash('password123');

      expect(bcrypt.getRounds(hash)).toBe(5);
    });

    it('falls back to 10 rounds when the setting is missing', async () => {
      const hash = await buildService().hash('password123');

      expect(bcrypt.getRounds(hash)).toBe(10);
    });

    it('falls back to 10 rounds when the setting is not a number', async () => {
      const hash = await buildService('not-a-number').hash('password123');

      expect(bcrypt.getRounds(hash)).toBe(10);
    });
  });

  describe('compare', () => {
    it('accepts the correct password', async () => {
      const service = buildService('4');
      const hash = await service.hash('password123');

      await expect(service.compare('password123', hash)).resolves.toBe(true);
    });

    it('rejects the wrong password', async () => {
      const service = buildService('4');
      const hash = await service.hash('password123');

      await expect(service.compare('wrong-password', hash)).resolves.toBe(
        false,
      );
    });
  });
});
