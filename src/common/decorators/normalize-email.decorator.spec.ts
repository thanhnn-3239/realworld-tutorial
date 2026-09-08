import { plainToInstance } from 'class-transformer';
import { NormalizeEmail } from './normalize-email.decorator';

class Probe {
  @NormalizeEmail()
  email: unknown;
}

function normalize(email: unknown): unknown {
  return plainToInstance(Probe, { email }).email;
}

describe('NormalizeEmail', () => {
  it.each([
    ['John@Example.COM', 'john@example.com'],
    ['ALL@UPPER.IO', 'all@upper.io'],
    ['  padded@example.com  ', 'padded@example.com'],
    ['already@lower.io', 'already@lower.io'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  // Non-strings are left alone so the validator, not the transformer, produces the error.
  it.each([undefined, null, 42, {}, []])('passes %p through untouched', (input) => {
    expect(normalize(input)).toEqual(input);
  });
});
