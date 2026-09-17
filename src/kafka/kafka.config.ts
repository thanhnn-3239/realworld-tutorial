import { KafkaOptions, Transport } from '@nestjs/microservices';
import { ARTICLE_NOTIFICATION_GROUP_ID } from './constants/kafka.constants';

export interface KafkaClientSettings {
  client: {
    clientId: string;
    brokers: string[];
    ssl?: boolean;
    sasl?:
      | { mechanism: 'plain'; username: string; password: string }
      | { mechanism: 'scram-sha-256'; username: string; password: string }
      | { mechanism: 'scram-sha-512'; username: string; password: string };
  };
  consumer: {
    groupId: string;
  };
}

export function parseKafkaConfig(): KafkaClientSettings {
  const brokerEnv = process.env.KAFKA_BROKER || 'localhost:9092';
  const brokers = brokerEnv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const ssl = process.env.KAFKA_SSL === 'true';
  const username = process.env.KAFKA_USERNAME;
  const password = process.env.KAFKA_PASSWORD;
  const mechanism = (process.env.KAFKA_SASL_MECHANISM ?? 'plain') as
    | 'plain'
    | 'scram-sha-256'
    | 'scram-sha-512';

  const sasl =
    username && password
      ? ({
          mechanism,
          username,
          password,
        } as KafkaClientSettings['client']['sasl'])
      : undefined;

  return {
    client: {
      clientId: process.env.KAFKA_CLIENT_ID ?? 'realworld-api',
      brokers,
      ...(ssl ? { ssl: true } : {}),
      ...(sasl ? { sasl } : {}),
    },
    consumer: {
      groupId: process.env.KAFKA_GROUP_ID ?? ARTICLE_NOTIFICATION_GROUP_ID,
    },
  };
}

export function createMicroserviceOptions(): KafkaOptions {
  const config = parseKafkaConfig();
  return {
    transport: Transport.KAFKA,
    options: {
      client: config.client,
      consumer: config.consumer,
    },
  };
}
