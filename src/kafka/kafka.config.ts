import { KafkaOptions, Transport } from '@nestjs/microservices';
import { ARTICLE_NOTIFICATION_GROUP_ID } from './constants/kafka.constants';

export interface KafkaSslSettings {
  ca: string[];
}

export interface KafkaClientSettings {
  client: {
    clientId: string;
    brokers: string[];
    ssl?: boolean | KafkaSslSettings;
    sasl?:
      | { mechanism: 'plain'; username: string; password: string }
      | { mechanism: 'scram-sha-256'; username: string; password: string }
      | { mechanism: 'scram-sha-512'; username: string; password: string };
  };
  consumer: {
    groupId: string;
  };
}

// PaaS dashboards (Render, Heroku) store env values on a single line, so a pasted
// PEM arrives with literal backslash-n sequences that must become real newlines.
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

// Brokers signed by a private CA (Aiven's per-project CA) are rejected by Node's
// default trust store, so the CA has to be handed to the TLS layer explicitly.
function buildSslSettings(ca?: string): boolean | KafkaSslSettings {
  return ca ? { ca: [normalizePem(ca)] } : true;
}

export function parseKafkaConfig(): KafkaClientSettings {
  const brokerEnv = process.env.KAFKA_BROKER || 'localhost:9092';
  const brokers = brokerEnv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const sslCa = process.env.KAFKA_SSL_CA?.trim() || undefined;
  // A CA without KAFKA_SSL=true would otherwise fall back to a plaintext
  // connection, so treat supplying one as intent to use TLS.
  const ssl = process.env.KAFKA_SSL === 'true' || Boolean(sslCa);
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
      ...(ssl ? { ssl: buildSslSettings(sslCa) } : {}),
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
