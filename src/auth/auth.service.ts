import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponseDto } from './dto/auth-response.dto';
import { PasswordService } from '../common/password/password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const { email, username, password } = dto;

    const existingEmail = await this.authRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.authRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await this.passwordService.hash(password);

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

    return new AuthResponseDto({
      email: user.email,
      username: user.username,
      token: token,
      bio: null,
      image: null,
    });
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = dto;

    const user = await this.authRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.compare(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    return new AuthResponseDto({
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      token,
    });
  }

  private generateToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}
