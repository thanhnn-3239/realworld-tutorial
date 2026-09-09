/**
 * The access-token claims. Deliberately only the subject: `email` and `username` are
 * mutable, so carrying them in a bearer token means serving stale values for as long as the
 * token lives.
 */
export interface JwtPayload {
  sub: number;
}
