import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

export const DEFAULT_SALT_ROUNDS = 10;

export function resolveSaltRounds(configured?: string): number {
  const parsed = Number.parseInt(configured ?? String(DEFAULT_SALT_ROUNDS), 10);
  return Number.isNaN(parsed) ? DEFAULT_SALT_ROUNDS : parsed;
}

export function hashPassword(
  plainPassword: string,
  saltRounds = DEFAULT_SALT_ROUNDS,
): Promise<string> {
  return bcrypt.hash(plainPassword, saltRounds);
}

export function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>(
      'BCRYPT_SALT_ROUNDS',
      String(DEFAULT_SALT_ROUNDS),
    );

    this.saltRounds = resolveSaltRounds(configured);
  }

  hash(plainPassword: string): Promise<string> {
    return hashPassword(plainPassword, this.saltRounds);
  }

  compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return comparePassword(plainPassword, hashedPassword);
  }
}
