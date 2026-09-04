import { RequestMethod, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('delegates to the service and stays version neutral', async () => {
    const service = { check: jest.fn().mockResolvedValue({ status: 'ok' }) };
    const controller = new HealthController(service as never);

    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
    expect(service.check).toHaveBeenCalledTimes(1);
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('health');
    expect(
      Reflect.getMetadata(PATH_METADATA, HealthController.prototype.getHealth),
    ).toBe('/');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        HealthController.prototype.getHealth,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        HealthController.prototype.getHealth,
      ),
    ).toBe(200);
    expect(Reflect.getMetadata(VERSION_METADATA, HealthController)).toBe(
      VERSION_NEUTRAL,
    );
  });
});
