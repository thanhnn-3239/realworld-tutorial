import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

const DEFAULT_SALT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    const configured = parseInt(
      this.configService.get<string>(
        'BCRYPT_SALT_ROUNDS',
        String(DEFAULT_SALT_ROUNDS),
      ),
      10,
    );

    this.saltRounds = Number.isNaN(configured)
      ? DEFAULT_SALT_ROUNDS
      : configured;
  }

  hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
