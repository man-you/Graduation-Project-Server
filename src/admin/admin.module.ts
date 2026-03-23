import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, AdminGuard],
})
export class AdminModule {}
