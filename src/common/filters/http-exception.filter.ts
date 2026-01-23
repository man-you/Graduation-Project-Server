import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // 更准确地记录错误信息
    if (exception instanceof Error) {
      this.logger.error({
        message: exception.message,
        name: exception.name,
        // stack: exception.stack,
        path: request.url,
        method: request.method,
      });
    } else {
      this.logger.error('Non-error exception caught:', exception);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();

      // 如果是 NestJS 的内置异常，也记录状态码
      if (status === 404) {
        this.logger.error(`Not Found: ${request.method} ${request.url}`);
      } else if (status === 400) {
        this.logger.error(
          `Bad Request: ${request.method} ${request.url}`,
          message,
        );
      }
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
