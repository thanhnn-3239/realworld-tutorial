import { readGoogleAuthConfig } from './google-auth.config';

const complete = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/v1/auth/google/callback',
};

describe('readGoogleAuthConfig', () => {
  it('returns the configuration when all three values are present', () => {
    expect(readGoogleAuthConfig(complete)).toEqual({
      clientID: complete.GOOGLE_CLIENT_ID,
      clientSecret: complete.GOOGLE_CLIENT_SECRET,
      callbackURL: complete.GOOGLE_CALLBACK_URL,
    });
  });

  it.each(Object.keys(complete))('returns null when %s is missing', (key) => {
    const partial = { ...complete };
    delete partial[key as keyof typeof complete];

    expect(readGoogleAuthConfig(partial)).toBeNull();
  });

  it.each(['', '   '])('treats %p as missing', (blank) => {
    expect(
      readGoogleAuthConfig({ ...complete, GOOGLE_CLIENT_ID: blank }),
    ).toBeNull();
  });

  it('trims surrounding whitespace, which .env files collect easily', () => {
    const config = readGoogleAuthConfig({
      ...complete,
      GOOGLE_CLIENT_ID: '  client-id  ',
    });

    expect(config?.clientID).toBe('client-id');
  });
});
