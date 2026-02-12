import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { TencentCosService } from './tencent-cos.service';

@Controller('tencent-cos')
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
    @Query('method') method?: 'get' | 'post' | 'put' | 'delete',
    @Query('expireTime') expireTime?: number,
  ) {
    return await this.tencentCosService.getSignedUrl(
      nodeId,
      method,
      expireTime ? Number(expireTime) : 3600,
    );
  }
}
