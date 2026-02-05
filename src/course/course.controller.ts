import { Controller, Get, Req } from '@nestjs/common';
import { CourseService } from './course.service';
import { Request } from 'express';

@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  /**
   *
   * @returns Courses
   */
  @Get('list')
  async findCourses(@Req() req: Request) {
    const userId = req['user']?.userId;
    return await this.courseService.findAllCourses(+userId);
  }
}
