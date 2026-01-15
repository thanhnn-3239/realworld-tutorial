import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface UserPayload {
  id: number;
  email: string;
  username: string;
}

export interface AuthResponse {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { email, username, password } = dto;

    const existingEmail = await this.authRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.authRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.authRepository.create({
      email,
      username,
      password: hashedPassword,
    });

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const { email, password } = dto;

    const user = await this.authRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token,
    };
  }

  private generateToken(payload: UserPayload): string {
    return this.jwtService.sign(payload);
  }
}
