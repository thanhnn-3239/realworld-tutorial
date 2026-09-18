import { parseKafkaConfig } from './kafka.config';

describe('parseKafkaConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses default plaintext configuration for local development', () => {
    delete process.env.KAFKA_BROKER;
    delete process.env.KAFKA_SSL;
    delete process.env.KAFKA_SSL_CA;
    delete process.env.KAFKA_USERNAME;
    delete process.env.KAFKA_PASSWORD;

    const config = parseKafkaConfig();
    expect(config.client.brokers).toEqual(['localhost:9092']);
    expect(config.client.ssl).toBeUndefined();
    expect(config.client.sasl).toBeUndefined();
  });

  it('falls back to default broker when KAFKA_BROKER is empty string', () => {
    process.env.KAFKA_BROKER = '';

    const config = parseKafkaConfig();
    expect(config.client.brokers).toEqual(['localhost:9092']);
  });

  it('parses custom broker list', () => {
    process.env.KAFKA_BROKER = 'kafka-1:9092,kafka-2:9092';

    const config = parseKafkaConfig();
    expect(config.client.brokers).toEqual(['kafka-1:9092', 'kafka-2:9092']);
  });

  it('configures SSL and SASL PLAIN for cloud services like Aiven', () => {
    process.env.KAFKA_BROKER = 'kafka-prod.aiven.io:12345';
    process.env.KAFKA_SSL = 'true';
    process.env.KAFKA_SASL_MECHANISM = 'plain';
    process.env.KAFKA_USERNAME = 'avnadmin';
    process.env.KAFKA_PASSWORD = 'supersecretpassword';

    const config = parseKafkaConfig();
    expect(config.client.brokers).toEqual(['kafka-prod.aiven.io:12345']);
    expect(config.client.ssl).toBe(true);
    expect(config.client.sasl).toEqual({
      mechanism: 'plain',
      username: 'avnadmin',
      password: 'supersecretpassword',
    });
  });

  it('passes the CA certificate through when the broker uses a private CA', () => {
    process.env.KAFKA_SSL = 'true';
    process.env.KAFKA_SSL_CA =
      '-----BEGIN CERTIFICATE-----\nMIIBmock\n-----END CERTIFICATE-----';

    const config = parseKafkaConfig();
    expect(config.client.ssl).toEqual({
      ca: ['-----BEGIN CERTIFICATE-----\nMIIBmock\n-----END CERTIFICATE-----'],
    });
  });

  it('restores literal escaped newlines in a single-line PEM env value', () => {
    process.env.KAFKA_SSL = 'true';
    process.env.KAFKA_SSL_CA =
      '-----BEGIN CERTIFICATE-----\\nMIIBmock\\n-----END CERTIFICATE-----';

    const config = parseKafkaConfig();
    expect(config.client.ssl).toEqual({
      ca: ['-----BEGIN CERTIFICATE-----\nMIIBmock\n-----END CERTIFICATE-----'],
    });
  });

  it('enables SSL implicitly when only a CA certificate is provided', () => {
    delete process.env.KAFKA_SSL;
    process.env.KAFKA_SSL_CA =
      '-----BEGIN CERTIFICATE-----\nMIIBmock\n-----END CERTIFICATE-----';

    const config = parseKafkaConfig();
    expect(config.client.ssl).toEqual({
      ca: ['-----BEGIN CERTIFICATE-----\nMIIBmock\n-----END CERTIFICATE-----'],
    });
  });

  it('ignores a blank CA certificate and keeps plain SSL', () => {
    process.env.KAFKA_SSL = 'true';
    process.env.KAFKA_SSL_CA = '   ';

    const config = parseKafkaConfig();
    expect(config.client.ssl).toBe(true);
  });
});
