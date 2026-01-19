import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  //使用中间件的时候必须加上next()
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[LoggingMiddleware] ${req.method} : ${req.originalUrl}`);
    //打印请求体
    console.log('Request Body:', req.body);
    //打印请求时间
    console.log('Request Time:', new Date().toISOString());
    next();
  }
}
