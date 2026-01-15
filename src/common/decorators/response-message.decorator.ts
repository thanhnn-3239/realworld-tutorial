import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'Success!';
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
