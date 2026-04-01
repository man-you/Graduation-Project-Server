import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  ParseIntPipe,
  Query,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TencentCosService } from './tencent-cos.service';
import {
  CreateTencentCoDto,
  BindResourceDto,
} from './dto/create-tencent-co.dto';
import { UpdateTencentCoDto } from './dto/update-tencent-co.dto';

@Controller('tencent-cos')
@UseInterceptors(ClassSerializerInterceptor)
export class TencentCosController {
  constructor(private readonly tencentCosService: TencentCosService) {}

  /**
   * 私有辅助函数：统一从 Request 中提取并校验 userId
   */
  private getUserIdFromReq(req: Request): number {
    const userId = req['user']?.userId;
    if (!userId) {
      throw new BadRequestException('用户信息无效，请重新登录');
    }
    return userId;
  }

  // ========== [GET 请求] ==========

  /**
   * 获取 COS 资源的预签名 URL（通用/预览）
   */
  @Get('signed-url')
  async getSignedUrl(
    @Query('nodeId', ParseIntPipe) nodeId: number,
    @Query('method') method: 'get' | 'post' | 'put' | 'delete' = 'get',
    @Query('expireTime') expireTime?: number,
    @Query('resourceType') resourceType?: 'PPT' | 'VIDEO' | 'PDF',
  ): Promise<string> {
    return await this.tencentCosService.getSignedUrl(
      nodeId,
      method,
      expireTime ? Number(expireTime) : 3600,
      resourceType,
    );
  }

  /**
   * 列出用户的目录内容（学生个人端）
   */
  @Get('user/list')
  async listUserDirectory(
    @Req() req: Request,
    @Query('path') path?: string,
  ): Promise<any> {
    const userId = this.getUserIdFromReq(req);

    return await this.tencentCosService.listUserDirectory(userId, path || '');
  }

  // ========== [POST 请求] ==========

  /**
   * 创建用户文件夹（学生个人端）
   */
  @Post('user/folder')
  async createUserFolder(
    @Body() createDto: CreateTencentCoDto,
    @Req() req: Request,
  ): Promise<any> {
    createDto.userId = this.getUserIdFromReq(req);
    createDto.resourceType = 'FOLDER';
    return await this.tencentCosService.createUserFolder(createDto);
  }

  /**
   * 上传用户文件（学生个人端）
   */
  @Post('user/file')
  async createUserFile(
    @Body() createDto: CreateTencentCoDto,
    @Req() req: Request,
  ): Promise<any> {
    createDto.userId = this.getUserIdFromReq(req);
    createDto.resourceType = 'FILE';
    return await this.tencentCosService.createUserFile(createDto);
  }

  /**
   * 上传/绑定教学资源（教师端）
   */
  @Post('teacher/resource')
  async createCourseResource(@Body() createDto: BindResourceDto): Promise<any> {
    return await this.tencentCosService.createCourseResource(createDto);
  }

  // ========== [PUT 请求] ==========

  /**
   * 重命名用户的文件或文件夹（学生个人端）
   */
  @Put('user/rename')
  async renameUserResource(
    @Body() updateDto: UpdateTencentCoDto,
    @Req() req: Request,
  ): Promise<any> {
    const userId = this.getUserIdFromReq(req);
    const { oldPath, newPath } = updateDto;

    if (!oldPath || !newPath) {
      throw new BadRequestException('必须提供 oldPath 和 newPath');
    }

    return await this.tencentCosService.renameUserResource(
      userId,
      oldPath,
      newPath,
    );
  }

  // ========== [DELETE 请求] ==========

  /**
   * 删除用户的文件或文件夹（学生个人端）
   * 使用 Query 传参
   */
  @Delete('user/delete')
  async deleteUserResource(
    @Req() req: Request,
    @Query('path') resourcePath: string,
  ): Promise<any> {
    const userId = this.getUserIdFromReq(req);
    if (!resourcePath) {
      throw new BadRequestException('必须提供 path 参数');
    }

    return await this.tencentCosService.deleteUserResource(
      userId,
      resourcePath,
    );
  }
}
