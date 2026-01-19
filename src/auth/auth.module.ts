import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule, // 导入 Prisma 全局模块
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 从配置文件获取密钥
        signOptions: { expiresIn: '1h' }, // 设置令牌过期时间
      }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService], // 只需要提供 AuthService
})
export class AuthModule {}
