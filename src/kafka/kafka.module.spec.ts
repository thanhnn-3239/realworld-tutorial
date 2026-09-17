import { Test, TestingModule } from '@nestjs/testing';
import { KafkaModule } from './kafka.module';
import { KAFKA_CLIENT } from './constants/kafka.constants';

describe('KafkaModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [KafkaModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should provide KAFKA_CLIENT', () => {
    const kafkaClient = moduleRef.get(KAFKA_CLIENT);
    expect(kafkaClient).toBeDefined();
  });
});
