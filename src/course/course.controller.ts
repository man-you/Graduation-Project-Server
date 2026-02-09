import { Controller, Get, Req, Param, ParseIntPipe } from '@nestjs/common';
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
  async findCourses(@Req() req: Request): Promise<any> {
    const userId = req['user']?.userId;
    return await this.courseService.findAllCourses(+userId);
  }

  /**
   *
   * @param id
   * @returns Course
   */
  @Get(':id')
  async getCourse(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return await this.courseService.getCourse(id);
  }
}
