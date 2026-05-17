import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitException extends HttpException {
  constructor(message = 'Request could not be completed. Try again later.') {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
