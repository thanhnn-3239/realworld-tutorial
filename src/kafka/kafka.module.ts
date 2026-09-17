import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KAFKA_CLIENT } from './constants/kafka.constants';
import { parseKafkaConfig } from './kafka.config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT,
        useFactory: () => {
          const config = parseKafkaConfig();
          return {
            transport: Transport.KAFKA,
            options: {
              client: config.client,
              producer: {
                allowAutoTopicCreation: true,
              },
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
