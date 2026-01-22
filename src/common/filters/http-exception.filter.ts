import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    }

    if (
      status === HttpStatus.BAD_REQUEST &&
      isValidationErrorResponse(message)
    ) {
      message = Array.isArray(message.message)
        ? message.message.join(', ')
        : message.message;
    }

    response.status(status).json({
      code: status,
      message: typeof message === 'string' ? message : 'Bad Request',
      data: null,
      timestamp: Date.now(),
    });
  }
}

/** 类型守卫 */
function isValidationErrorResponse(
  value: unknown,
): value is { message: string | string[] } {
  return typeof value === 'object' && value !== null && 'message' in value;
}
