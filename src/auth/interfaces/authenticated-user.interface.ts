/**
 * What `JwtStrategy.validate` puts on `request.user`. Named `id` rather than `sub` so every
 * controller that already reads `user.id` is untouched by the token payload shrinking.
 */
export interface AuthenticatedUser {
  id: number;
}
