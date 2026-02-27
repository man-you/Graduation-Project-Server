import { Module } from '@nestjs/common';
import { TencentCosService } from './tencent-cos.service';
import { TencentCosController } from './tencent-cos.controller';
import { AuthModule } from '../../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    PrismaModule,
  ],
  controllers: [TencentCosController],
  providers: [TencentCosService],
  exports: [TencentCosService], // 如果其他模块需要使用，导出服务
})
export class TencentCosModule {}