import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap/configure-app';
import { createContentPreviewGrpcOptions } from './content-preview/content-preview-grpc.config';
import { CustomLoggerService } from './logger/logger.service';
import { createMicroserviceOptions } from './kafka/kafka.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  app.useLogger(await app.resolve(CustomLoggerService));

  configureApp(app);

  app.connectMicroservice(createContentPreviewGrpcOptions());

  if (process.env.ENABLE_KAFKA !== 'false') {
    app.connectMicroservice(createMicroserviceOptions());
  }

  await app.startAllMicroservices();

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('RealWorld API')
    .setDescription('RealWorld API documentation - Conduit clone')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
