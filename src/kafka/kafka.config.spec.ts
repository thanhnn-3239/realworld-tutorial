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
    delete process.env.KAFKA_USERNAME;
    delete process.env.KAFKA_PASSWORD;

    const config = parseKafkaConfig();
    expect(config.client.brokers).toEqual(['localhost:9092']);
    expect(config.client.ssl).toBeUndefined();
    expect(config.client.sasl).toBeUndefined();
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
});
