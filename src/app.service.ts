import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from './prisma/prisma.service';
import { CustomLoggerService } from './logger/logger.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
    private readonly i18n: I18nService,
  ) {
  }

  async getHello(): Promise<string> {
    const users = await this.prisma.user.findMany();
    const hello = this.i18n.t('common.hello');
    const welcome = this.i18n.t('common.welcome');
    this.logger.log('Hello World!');
    return `${hello}! ${welcome} - Users: ${users.length}`;
  }
}
