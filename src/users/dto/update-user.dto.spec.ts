import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';
import { AUTH_VALIDATION } from '../../auth/auth.config';

// Mirror the production pipe options that affect which errors come back.
async function validatePayload(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateUserDto, payload);
  return validate(dto as object, { whitelist: true, stopAtFirstError: true });
}

async function messagesFor(payload: Record<string, unknown>) {
  const errors = await validatePayload(payload);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

async function propertiesInError(payload: Record<string, unknown>) {
  const errors = await validatePayload(payload);
  return errors.map((error) => error.property);
}

describe('UpdateUserDto', () => {
  it('accepts an empty payload (nothing to update)', async () => {
    await expect(propertiesInError({})).resolves.toEqual([]);
  });

  it('accepts a full valid payload', async () => {
    // An avatar is only ever set by uploading a file, so the JSON payload's
    // `image` can only legally be null here, not a string.
    await expect(
      propertiesInError({
        username: 'newusername',
        bio: 'I like to code',
        image: null,
      }),
    ).resolves.toEqual([]);
  });

  it('ignores credential fields, which are no longer part of the contract', async () => {
    // `whitelist` strips undeclared properties before validation, so these raise no error
    // and reach no column either.
    await expect(
      propertiesInError({
        username: 'newusername',
        email: 'someone@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual([]);
  });

  describe('null on columns that are required in the database', () => {
    // `@ValidateIf(value !== undefined)` treats only an absent field as
    // "omitted", so `null` still runs the validators below it and is rejected.
    it.each(['username'])('rejects %s: null', async (field) => {
      await expect(propertiesInError({ [field]: null })).resolves.toContain(
        field,
      );
    });
  });

  describe('error messages', () => {
    it.each(['username'])(
      'reports one message for %s: null, naming the real cause',
      async (field) => {
        const messages = await messagesFor({ [field]: null });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain('common.validation.invalid');
      },
    );

    it('still reports the length rule when the value is a too-long string', async () => {
      const messages = await messagesFor({
        username: 'a'.repeat(AUTH_VALIDATION.username.maxLength + 1),
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('common.validation.maxLength');
    });

    it('reports every invalid field, one message each', async () => {
      const errors = await validatePayload({
        image: 'not-a-url',
        username: null,
      });

      expect(errors.map((error) => error.property).sort()).toEqual([
        'image',
        'username',
      ]);
      errors.forEach((error) => {
        expect(Object.values(error.constraints ?? {})).toHaveLength(1);
      });
    });
  });

  describe('null handling for nullable columns', () => {
    it('allows bio: null to clear the field', async () => {
      await expect(propertiesInError({ bio: null })).resolves.toEqual([]);
    });

    it('allows image: null to clear the field', async () => {
      await expect(propertiesInError({ image: null })).resolves.toEqual([]);
    });
  });

  describe('username', () => {
    it('rejects a value shorter than the minimum', async () => {
      const tooShort = 'a'.repeat(AUTH_VALIDATION.username.minLength - 1);

      await expect(
        propertiesInError({ username: tooShort }),
      ).resolves.toContain('username');
    });

    it('rejects a value longer than the maximum', async () => {
      const tooLong = 'a'.repeat(AUTH_VALIDATION.username.maxLength + 1);

      await expect(propertiesInError({ username: tooLong })).resolves.toContain(
        'username',
      );
    });

    it('rejects a non-string value', async () => {
      await expect(propertiesInError({ username: 12345 })).resolves.toContain(
        'username',
      );
    });
  });

  describe('image', () => {
    it('accepts null, which clears the avatar', async () => {
      await expect(propertiesInError({ image: null })).resolves.toEqual([]);
    });

    it.each(['https://example.com/a.jpg', 'public/uploads/User/9/a.png', ''])(
      'rejects %p: an avatar is set by uploading a file, never by naming one',
      async (value) => {
        await expect(propertiesInError({ image: value })).resolves.toContain(
          'image',
        );
      },
    );
  });
});
