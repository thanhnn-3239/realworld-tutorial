/**
 * Auth validation constraints configuration
 * Centralized config for validation rules used in DTOs and validators
 */
export const AUTH_VALIDATION = {
  username: {
    minLength: 3,
    maxLength: 30,
  },
  password: {
    minLength: 6,
    maxLength: 128,
  },
} as const;
