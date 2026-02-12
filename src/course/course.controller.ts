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
   * 获取课程大纲 (Outline)
   * 场景：用于课程详情页面的树状列表展示
   * 字段：id, nodeName, nodeLevel, description, childNodes
   */
  @Get(':id')
  async getCourseOutline(@Param('id', ParseIntPipe) id: number) {
    return await this.courseService.getCourse(id);
  }

  /**
   * 获取课程知识图谱 (Knowledge Graph)
   * 场景：用于 D3.js 可视化页面，包含资源详情和腾讯云 COS 签名
   * 字段：包含 Outline 所有字段 + resource (signedUrl, fileSize 等)
   */
  @Get('graph/:id')
  async getCourseKnowledgeGraph(@Param('id', ParseIntPipe) id: number) {
    return await this.courseService.getCourseKnowledgeGraph(+id);
  }
}
