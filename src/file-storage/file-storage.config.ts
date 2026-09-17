import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export function requireConfig(
  configService: ConfigService,
  key: string,
): string {
  const value = configService.get<string>(key);
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`);
  }
  return value;
}

export function createS3Client(configService: ConfigService): S3Client {
  const endpoint = configService.get<string>('STORAGE_ENDPOINT');
  return new S3Client({
    region: configService.get<string>('STORAGE_REGION', 'us-east-1'),
    credentials: {
      accessKeyId: configService.get<string>('STORAGE_ACCESS_KEY', ''),
      secretAccessKey: configService.get<string>('STORAGE_SECRET_KEY', ''),
    },
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
}
