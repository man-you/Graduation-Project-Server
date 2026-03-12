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
import { TencentCosService } from './tencent-cos.service';
import { CreateTencentCoDto } from './dto/create-tencent-co.dto';
import { UpdateTencentCoDto } from './dto/update-tencent-co.dto';

@Controller('tencent-cos')
@UseInterceptors(ClassSerializerInterceptor)
export class TencentCosController {
  constructor(private readonly tencentCosService: TencentCosService) {}

  /**
   * 获取COS资源的预签名URL，用于前端临时访问
   * @param nodeId 数据库中资源节点的ID
   * @param method HTTP请求方法，默认get
   * @param expireTime 签名过期时间（秒），默认3600秒
   */
  @Get('signed-url')
  async getSignedUrl(
    @Query('nodeId', ParseIntPipe) nodeId: number,
    @Req() req: Request,
    @Query('method') method?: 'get' | 'post' | 'put' | 'delete',
    @Query('expireTime') expireTime?: number,
  ): Promise<any> {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    return await this.tencentCosService.getSignedUrl(
      nodeId,
      method,
      expireTime ? Number(expireTime) : 3600,
    );
  }

  /**
   * 创建用户文件夹（需要认证）
   * @param createDto 文件夹创建信息
   * @param currentUser 当前认证用户
   */
  @Post('user/folder')
  async createUserFolder(
    @Body() createDto: CreateTencentCoDto,
    @Req() req: Request,
  ) {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    createDto.userId = req['user'].userId;
    return await this.tencentCosService.createUserFolder(createDto);
  }

  /**
   * 上传用户文件（需要认证）
   * @param createDto 文件创建信息
   * @param currentUser 当前认证用户
   */
  @Post('user/file')
  async createUserFile(
    @Body() createDto: CreateTencentCoDto,
    @Req() req: Request,
  ) {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    createDto.userId = req['user'].userId;
    return await this.tencentCosService.createUserFile(createDto);
  }

  /**
   * 列出用户的目录内容（需要认证）
   * @param currentUser 当前认证用户
   * @param path 目录路径，可选
   */
  @Get('user/list')
  async listUserDirectory(@Req() req: Request, @Query('path') path?: string) {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    return await this.tencentCosService.listUserDirectory(
      req['user'].userId,
      path,
    );
  }

  /**
   * 重命名用户的文件或文件夹（需要认证）
   * @param currentUser 当前认证用户
   * @param updateDto 包含oldPath和newPath的更新信息
   */
  @Put('user/rename')
  async renameUserResource(
    @Body() updateDto: UpdateTencentCoDto,
    @Req() req: Request,
  ) {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    const { oldPath, newPath } = updateDto as any;
    if (!oldPath || !newPath) {
      throw new BadRequestException('必须提供oldPath和newPath');
    }
    return await this.tencentCosService.renameUserResource(
      req['user'].userId,
      oldPath,
      newPath,
    );
  }

  /**
   * 删除用户的文件或文件夹（需要认证）
   * @param currentUser 当前认证用户
   * @param resourcePath 资源路径
   */
  @Delete('user/delete')
  async deleteUserResource(
    @Req() req: Request,
    @Query('path') resourcePath: string,
  ) {
    if (!req['user'] || !req['user'].userId) {
      throw new BadRequestException('用户信息无效');
    }
    if (!resourcePath) {
      throw new BadRequestException('必须提供path参数');
    }
    return await this.tencentCosService.deleteUserResource(
      req['user'].userId,
      resourcePath,
    );
  }
}
