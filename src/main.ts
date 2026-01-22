import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 设置全局路由前缀
  app.setGlobalPrefix('api/v1');

  // 注册响应拦截器
  app.useGlobalInterceptors(new ResponseInterceptor());

  // 注册异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 初始化 Swagger
  const options = new DocumentBuilder()
    .setTitle('Moon-Server')
    .setDescription('Moon-Server API 文档')
    .setVersion('1.0')
    .addTag('Moon-Server')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/v1/docs', app, document);

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
