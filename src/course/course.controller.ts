import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Param,
  ParseIntPipe,
  Body,
  HttpException,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { Request } from 'express';
import { AssignCourseDto } from './dto/assign-course.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Course')
@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  /**
   *  创建节点（根课程或子知识点）
   */
  @Post()
  async createNode(
    @Req() req: Request,
    @Body() createCourseDto: CreateCourseDto,
  ): Promise<any> {
    const userId = this.getUserId(req);
    return await this.courseService.createNode(userId, createCourseDto);
  }

  /**
   *  更新节点信息
   */
  @Patch(':id')
  async updateNode(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<any> {
    const userId = this.getUserId(req);
    return await this.courseService.updateNode(userId, id, updateCourseDto);
  }

  /**
   *  删除节点（递归删除子节点）
   */
  @Delete(':id')
  async deleteNode(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    const userId = this.getUserId(req);
    return await this.courseService.deleteNode(userId, id);
  }

  /**
   *  获取课程列表
   *  教师看到自己创建的，学生看到被分配的
   */
  @Get('list')
  async findCourses(@Req() req: Request): Promise<any> {
    const userId = this.getUserId(req);
    return await this.courseService.findAllCourses(userId);
  }

  /**
   * 分配课程给学生
   * 核心：操作 Prisma 隐式中间表
   */
  @Post('assign')
  async assignCourseToStudents(
    @Req() req: Request,
    @Body() assignCourseDto: AssignCourseDto,
  ): Promise<any> {
    const teacherId = this.getUserId(req);
    return await this.courseService.assignCourseToStudents(
      teacherId,
      assignCourseDto,
    );
  }

  /**
   *  获取课程大纲（嵌套树结构）
   */
  @Get(':id')
  async getCourseOutline(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return await this.courseService.getCourse(id);
  }

  /**
   *  获取知识图谱（带资源和 COS 签名）
   */
  @Get('graph/:id')
  async getCourseKnowledgeGraph(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    return await this.courseService.getCourseKnowledgeGraph(id);
  }

  /**
   * 统一从 Request 获取并校验 UserId
   */
  private getUserId(req: Request): number {
    const userId = req['user']?.userId;
    if (!userId) {
      throw new HttpException('用户未认证或登录已过期', 404);
    }
    return Number(userId);
  }
}
