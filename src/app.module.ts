import { Module, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middleware/logger.middleware';
import * as cookieParser from 'cookie-parser';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ChatModule } from './chat/chat.module';
import { CourseModule } from './course/course.module';
import { TencentCosModule } from './common/tencent-cos/tencent-cos.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ChatModule,
    CourseModule,
    TencentCosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, cookieParser()) //拦截器名称
      .forRoutes('*'); //作用于所有的路由
  }
}
