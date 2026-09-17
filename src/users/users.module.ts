import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AvatarReplacementService } from './avatar-replacement.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageProcessingModule } from '../image-processing/image-processing.module';

@Module({
  imports: [PrismaModule, ImageProcessingModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, AvatarReplacementService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
