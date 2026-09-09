export const GOOGLE_AUTH_CONFIG = 'GOOGLE_AUTH_CONFIG';

export interface GoogleAuthConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

/**
 * Reads `process.env` directly rather than through `ConfigService`, because the decision it
 * feeds — whether to register the module at all — happens before DI exists. `@nestjs/config`
 * is global and loads `.env` into `process.env`, so both see the same values.
 *
 * Returns `null` rather than throwing: Google is an optional feature, so absent
 * configuration must leave the app bootable with the routes simply missing. That is the
 * opposite of `JWT_SECRET`, whose absence makes the whole API meaningless.
 */
export function readGoogleAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleAuthConfig | null {
  const clientID = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const callbackURL = env.GOOGLE_CALLBACK_URL?.trim();

  if (!clientID || !clientSecret || !callbackURL) {
    return null;
  }

  return { clientID, clientSecret, callbackURL };
}
