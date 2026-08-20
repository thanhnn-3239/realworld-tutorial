import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, VersioningType } from '@nestjs/common';

import { AppModule } from './app.module';
import { CustomLoggerService } from './logger/logger.service';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import validationOptions from './common/validation/validation-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const reflector = app.get(Reflector);

  app.enableShutdownHooks();
  app.useLogger(await app.resolve(CustomLoggerService));

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(
    new TransformInterceptor(reflector),
    new ClassSerializerInterceptor(reflector),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('RealWorld API')
    .setDescription('RealWorld API documentation - Conduit clone')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
