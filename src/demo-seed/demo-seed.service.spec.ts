import { validateDemoPassword } from './demo-seed.service';

describe('validateDemoPassword', () => {
  it('rejects a missing password with one generic configuration error', () => {
    expect(() => validateDemoPassword(undefined)).toThrow(
      'DEMO_USER_PASSWORD is not configured correctly.',
    );
  });

  it('rejects values shorter than the auth minimum', () => {
    expect(() => validateDemoPassword('12345')).toThrow(
      'DEMO_USER_PASSWORD is not configured correctly.',
    );
  });

  it('rejects exactly three emoji because they are fewer than six characters', () => {
    expect(() => validateDemoPassword('😀😀😀')).toThrow(
      'DEMO_USER_PASSWORD is not configured correctly.',
    );
  });

  it('accepts values within the auth bounds', () => {
    expect(validateDemoPassword('password123')).toBe('password123');
  });
});
