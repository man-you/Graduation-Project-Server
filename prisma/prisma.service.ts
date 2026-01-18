import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // NestJS 模块初始化时自动连接数据库
  async onModuleInit() {
    await this.$connect();
  }

  // NestJS 模块销毁时自动断开数据库连接
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
