import {
  HttpStatus,
  UnprocessableEntityException,
  ValidationPipeOptions,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { I18nContext } from 'nestjs-i18n';

function formatI18nMessage(constraint: string): string {
  const i18n = I18nContext.current();
  if (!i18n) return constraint;

  // Parse i18n validation message format: "key|{...args}"
  if (constraint.includes('|')) {
    const [key, argsString] = constraint.split('|');
    try {
      const args = JSON.parse(argsString);
      return i18n.t(key, { args });
    } catch {
      return i18n.t(key);
    }
  }

  return constraint;
}

function generateErrors(errors: ValidationError[]) {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrors(currentValue.children ?? [])
          : Object.values(currentValue.constraints ?? {})
              .map(formatI18nMessage)
              .join(', '),
    }),
    {},
  );
}

const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) => {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: generateErrors(errors),
    });
  },
};

export default validationOptions;
