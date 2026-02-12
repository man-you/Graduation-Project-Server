import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { TencentCosService } from 'src/common/tencent-cos/tencent-cos.service';

@Module({
  controllers: [CourseController],
  providers: [CourseService, TencentCosService],
})
export class CourseModule {}
