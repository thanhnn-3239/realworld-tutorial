import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmProviderLinkDto } from './confirm-provider-link.dto';

async function invalidProperties(payload: Record<string, unknown>) {
  const dto = plainToInstance(ConfirmProviderLinkDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    stopAtFirstError: true,
  });

  return errors.map((error) => error.property);
}

describe('ConfirmProviderLinkDto', () => {
  it('accepts a 43-character string token', async () => {
    await expect(invalidProperties({ token: 'a'.repeat(43) })).resolves.toEqual(
      [],
    );
  });

  it.each([
    ['missing', {}],
    ['not a string', { token: 7 }],
    ['too short', { token: 'a'.repeat(42) }],
    ['too long', { token: 'a'.repeat(44) }],
  ])('rejects a %s token', async (_, payload) => {
    await expect(invalidProperties(payload)).resolves.toContain('token');
  });
});
