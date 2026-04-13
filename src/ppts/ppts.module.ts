import { Module } from '@nestjs/common';
import { PptsService } from './ppts.service';
import { PptsController } from './ppts.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import xunfeiConfig from './ppts.config';

@Module({
  imports: [HttpModule, ConfigModule.forFeature(xunfeiConfig)],
  controllers: [PptsController],
  providers: [PptsService],
})
export class PptsModule {}
