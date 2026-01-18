import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 设置全局路由前缀
  app.setGlobalPrefix('api/v1');

  // 初始化 Swagger
  const options = new DocumentBuilder()
    .setTitle('Moon-Server')
    .setDescription('Moon-Server API 文档')
    .setVersion('1.0')
    .addTag('Moon-Server')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/v1/docs', app, document);

  await app.listen(3000);
}
bootstrap();
