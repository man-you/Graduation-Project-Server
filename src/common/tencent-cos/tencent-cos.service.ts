import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as COS from 'cos-nodejs-sdk-v5';
import { PrismaService } from '../../../prisma/prisma.service';
@Injectable()
export class TencentCosService {
  private cosClient: COS;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretId = this.configService.get('TENCENT_COS_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_COS_SECRET_KEY');

    if (!secretId || !secretKey) {
      throw new Error('TENCENT_COS_SECRET_ID 或 TENCENT_COS_SECRET_KEY 未配置');
    }

    this.cosClient = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });
  }

  /**
   * 获取预签名 URL，用于前端临时访问COS资源
   * @param key COS对象的存储路径（如 'images/avatar.png'）
   * @param method HTTP请求方法，默认get
   * @param expireTime 签名过期时间（秒），默认3600秒
   * @returns 预签名URL字符串
   */
  async getSignedUrl(
    nodeId: number,
    method: 'get' | 'post' | 'put' | 'delete' = 'get',
    expireTime: number = 3600,
  ): Promise<string> {
    // 1. 基础配置校验（补充密钥校验）
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');
    const secretId = this.configService.get('TENCENT_COS_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_COS_SECRET_KEY');

    if (!bucket || !region) {
      throw new Error('COS配置（bucket/region）未正确配置');
    }
    if (!secretId || !secretKey) {
      throw new Error('COS密钥（secretId/secretKey）配置缺失');
    }

    // 2. 查询资源路径并校验（确保Key带空格）
    const keyResult = await this.prisma.resource.findUnique({
      where: { nodeId },
      select: { resourcePath: true },
    });
    if (!keyResult || !keyResult.resourcePath) {
      throw new Error(`未找到nodeId=${nodeId}对应的资源路径`);
    }
    const originalKey = keyResult.resourcePath;
    // 提取文件名用于响应头（仅编码文件名，避免中文乱码）
    const fileName = originalKey.split('/').pop() || '';
    const encodedFileName = encodeURIComponent(fileName);

    try {
      // 3. 直接调用getAuth（同步方法，返回签名字符串）
      const authorization = this.cosClient.getAuth({
        Method: method.toUpperCase() as COS.Method, // 确保类型匹配
        Key: originalKey, // 原始Key（带空格，SDK自动处理编码）
        Expires: expireTime,
        Bucket: bucket,
        Region: region,
      });

      // 4. 构建完整的预签名URL
      if (!authorization) {
        throw new Error('COS未返回有效的预签名URL');
      }

      const url = `https://${bucket}.cos.${region}.myqcloud.com/${originalKey}?${authorization}&response-content-disposition=inline%3B%20filename%3D%22${encodedFileName}%22`;
      return url;
    } catch (error) {
      console.error('COS生成签名失败:', {
        error: error.message || error,
        nodeId,
        originalKey,
        bucket,
        region,
        secretId: secretId.substring(0, 10) + '...', // 脱敏展示
      });
      throw new Error(
        `COS签名生成失败：${error.message || JSON.stringify(error)}`,
      );
    }
  }
}
