import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS = require('cos-nodejs-sdk-v5');
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateTencentCoDto,
  BindResourceDto,
} from './dto/create-tencent-co.dto';

/**
 * 腾讯云 COS (Cloud Object Storage) 服务类
 * 负责处理用户文件和课程资源在腾讯云存储中的操作，包括创建、读取、更新和删除
 */
@Injectable()
export class TencentCosService {
  private cosClient: COS;
  private readonly bucket: string;
  private readonly region: string;

  /**
   * 构造函数 - 初始化腾讯云 COS 客户端
   * @param configService 配置服务，用于获取腾讯云 COS 的配置信息
   * @param prisma Prisma 数据库服务
   */
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.bucket = this.configService.get('TENCENT_COS_BUCKET');
    this.region = this.configService.get('TENCENT_COS_REGION');
    const secretId = this.configService.get('TENCENT_COS_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_COS_SECRET_KEY');

    if (!secretId || !secretKey || !this.bucket || !this.region) {
      throw new HttpException('Tencent COS 配置不完整', 500);
    }
    this.cosClient = new COS({ SecretId: secretId, SecretKey: secretKey });
  }

  // ========== [资源创建操作] ==========

  /**
   * 创建用户文件夹
   * @param dto 创建腾讯云资源 DTO，包含用户ID、资源名称等信息
   * @returns 创建的用户文件记录
   */
  async createUserFolder(dto: CreateTencentCoDto): Promise<any> {
    const path = this.buildFullPath(dto, true);
    await this.execCosAction('putObject', {
      Bucket: this.bucket,
      Region: this.region,
      Key: path,
      Body: '',
    });
    return this.prisma.userFile.create({
      data: {
        fileName: dto.resourceName,
        filePath: path,
        isFolder: true,
        userId: dto.userId,
      },
    });
  }

  /**
   * 创建用户文件（返回上传 URL）
   * @param dto 创建腾讯云资源 DTO，包含用户ID、资源名称、文件大小、格式等信息
   * @returns 包含数据库记录和上传 URL 的对象
   */
  async createUserFile(dto: CreateTencentCoDto): Promise<any> {
    const path = this.buildFullPath(dto, false);
    const uploadUrl = await this.getSignedUrlForUpload(path);
    const record = await this.prisma.userFile.create({
      data: {
        fileName: dto.resourceName,
        filePath: path,
        fileSize: dto.fileSize,
        fileFormat: dto.fileFormat,
        isFolder: false,
        userId: dto.userId,
      },
    });
    return { ...record, uploadUrl };
  }

  /**
   * 创建或更新课程资源（如视频、文档等）
   * @param dto 绑定资源 DTO，包含节点ID、资源类型、资源名称等信息
   * @returns 包含数据库记录和上传 URL 的对象
   */
  async createCourseResource(dto: BindResourceDto): Promise<any> {
    const { nodeId, resourceType, resourceName, fileSize, fileFormat } = dto;
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new HttpException(`知识节点不存在: ${nodeId}`, 400);

    const newPath = this.formatPath(
      `resources/${nodeId}/${resourceType.toLowerCase()}/${resourceName}`,
      false,
    );
    const existing = await this.prisma.resource.findFirst({
      where: { nodeId, resourceType },
    });

    if (existing && existing.resourcePath !== newPath) {
      await this.internalCosDelete(existing.resourcePath).catch((e) =>
        console.warn('清理旧文件失败', e.message),
      );
    }

    const uploadUrl = await this.getSignedUrlForUpload(newPath);
    const data = { resourceName, resourcePath: newPath, fileSize, fileFormat };
    const record = existing
      ? await this.prisma.resource.update({ where: { id: existing.id }, data })
      : await this.prisma.resource.create({
          data: { ...data, resourceType, nodeId },
        });

    return { ...record, uploadUrl };
  }

  // ========== [资源读取操作] ==========

  /**
   * 列出用户目录下的所有资源（包括个人资源和已加入课程的公共资源）
   * @param userId 用户ID
   * @param path 目录路径（可选，默认为根目录）
   * @returns 资源列表
   */
  async listUserDirectory(userId: number, path: string = ''): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new HttpException('用户不存在', 400);

    const userBasePath = `users/${userId}`;
    const userPrefix = this.formatPath(
      path ? `${userBasePath}/${path}` : userBasePath,
      true,
    );
    let allResources = await this.fetchAndMapResources(
      userPrefix,
      userId,
      userBasePath,
      false,
    );

    // 学生根目录额外拉取已加入课程的公共资源
    if (user.role === 'student' && path === '') {
      const enrolled = await this.prisma.node.findMany({
        where: {
          students: { some: { id: userId } },
          parentNodeId: null,
        } as any,
        select: { id: true, creatorId: true },
      });

      const courseResources = await Promise.all(
        enrolled.map(async (course) => {
          if (!course.creatorId) return [];
          const basePath = `public/${course.creatorId}/${course.id}`;
          return this.fetchAndMapResources(
            this.formatPath(basePath, true),
            course.creatorId,
            basePath,
            true,
          );
        }),
      );
      allResources = [...allResources, ...courseResources.flat()];
    }
    return allResources;
  }

  /**
   * 列出课程目录下的所有资源
   * @param userId 用户ID（课程创建者）
   * @param path 目录路径（可选，默认为根目录）
   * @param courseId 课程ID
   * @returns 资源列表
   */
  async listCourseDirectory(
    userId: number,
    path: string = '',
    courseId: number,
  ): Promise<any> {
    const basePath = `public/${userId}/${courseId}`;
    return this.fetchAndMapResources(
      this.formatPath(path ? `${basePath}/${path}` : basePath, true),
      userId,
      basePath,
      false,
    );
  }

  /**
   * 获取单个资源的签名 URL（用于下载或上传）
   * @param nodeId 知识节点ID（可选）
   * @param fileId 文件ID（可选）
   * @param method HTTP 方法（默认为 'GET'）
   * @param expireTime 过期时间（秒，默认为 3600 秒）
   * @param resourceType 资源类型（可选）
   * @returns 签名 URL 字符串
   */
  async getSignedUrl(
    nodeId?: number,
    fileId?: number,
    method = 'GET',
    expireTime = 3600,
    resourceType?: any,
  ): Promise<string> {
    let finalPath: string, fileName: string;

    if (fileId) {
      const file = await this.prisma.userFile.findUnique({
        where: { id: fileId },
      });
      if (!file) throw new HttpException('文件不存在', 404);
      [finalPath, fileName] = [file.filePath, file.fileName];
    } else if (nodeId) {
      const res = await this.prisma.resource.findFirst({
        where: { nodeId, ...(resourceType && { resourceType }) },
      });
      if (!res) throw new HttpException('资源不存在', 404);
      [finalPath, fileName] = [
        res.resourcePath,
        res.resourcePath.split('/').pop(),
      ];
    } else {
      throw new HttpException('参数错误', 400);
    }

    const auth = this.cosClient.getAuth({
      Method: method.toUpperCase() as any,
      Key: finalPath,
      Expires: expireTime,
      Bucket: this.bucket,
      Region: this.region,
    });
    let url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${finalPath}?${auth}`;

    if (!/\.(mp4|webm|ogg|mp3|wav|mov)$/i.test(finalPath)) {
      const disposition =
        method.toUpperCase() === 'GET' ? 'attachment' : 'inline';
      url += `&response-content-disposition=${disposition};filename="${encodeURIComponent(fileName)}"`;
    }
    return url;
  }

  /**
   * 批量获取多个节点资源的签名 URL
   * @param nodeIds 节点ID数组
   * @param method HTTP 方法（默认为 'get'）
   * @param expireTime 过期时间（秒，默认为 3600 秒）
   * @returns 节点ID到URL数组的映射
   */
  async getMultipleSignedUrls(
    nodeIds: number[],
    method: any = 'get',
    expireTime = 3600,
  ): Promise<Map<number, string[]>> {
    const keyResults = await this.prisma.resource.findMany({
      where: { nodeId: { in: nodeIds } },
      orderBy: { id: 'asc' },
    });

    if (!keyResults.length) throw new HttpException('未找到资源', 404);
    const nodeUrlMap = new Map<number, string[]>();

    for (const res of keyResults) {
      const auth = this.cosClient.getAuth({
        Method: method.toUpperCase(),
        Key: res.resourcePath,
        Expires: expireTime,
        Bucket: this.bucket,
        Region: this.region,
      });
      const encodedName = encodeURIComponent(
        res.resourcePath.split('/').pop() || '',
      );
      const url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${res.resourcePath}?${auth}&response-content-disposition=inline%3B%20filename%3D%22${encodedName}%22`;

      if (!nodeUrlMap.has(res.nodeId)) nodeUrlMap.set(res.nodeId, []);
      nodeUrlMap.get(res.nodeId).push(url);
    }
    return nodeUrlMap;
  }

  // ========== [更新与删除操作] ==========

  /**
   * 删除用户资源（文件或文件夹）
   * @param userId 用户ID
   * @param resourcePath 资源路径
   * @param courseId 课程ID（可选，用于公共课程资源）
   * @returns 操作结果
   */
  async deleteUserResource(
    userId: number,
    resourcePath: string,
    courseId?: number,
  ): Promise<any> {
    const isFolder = resourcePath.endsWith('/');
    const fullPath = this.buildFullPath(
      { userId, courseId, resourceName: resourcePath },
      isFolder,
    );
    await this.internalCosDelete(fullPath);
    await this.prisma.userFile.deleteMany({
      where: {
        filePath: isFolder ? { startsWith: fullPath } : fullPath,
        userId,
      },
    });
    return { success: true };
  }

  /**
   * 重命名用户资源（文件或文件夹）
   * @param userId 用户ID
   * @param oldPath 旧路径
   * @param newPath 新路径
   * @param courseId 课程ID（可选，用于公共课程资源）
   * @returns 操作结果，包含新的相对路径
   */
  async renameUserResource(
    userId: number,
    oldPath: string,
    newPath: string,
    courseId?: number,
  ): Promise<any> {
    const basePath = courseId
      ? `public/${userId}/${courseId}`
      : `users/${userId}`;
    const isFolder = oldPath.endsWith('/');
    const fullOld = this.formatPath(`${basePath}/${oldPath}`, isFolder);

    const relativeNew = newPath.includes('/')
      ? newPath
      : [...oldPath.replace(/\/+$/, '').split('/').slice(0, -1), newPath].join(
          '/',
        );
    const fullNew = this.formatPath(`${basePath}/${relativeNew}`, isFolder);

    if (fullOld === fullNew) return { success: true };

    if (isFolder) {
      const list = await this.execCosAction('getBucket', {
        Bucket: this.bucket,
        Region: this.region,
        Prefix: fullOld,
      });
      for (const item of list.Contents || []) {
        await this.moveSingleObject(
          item.Key,
          item.Key.replace(fullOld, fullNew),
        );
      }
      const files = await this.prisma.userFile.findMany({
        where: { filePath: { startsWith: fullOld }, userId },
      });
      await Promise.all(
        files.map((f) =>
          this.prisma.userFile.update({
            where: { id: f.id },
            data: {
              filePath: f.filePath.replace(fullOld, fullNew),
              ...(f.filePath === fullOld
                ? { fileName: newPath.replace(/\/$/, '') }
                : {}),
            },
          }),
        ),
      );
    } else {
      await this.moveSingleObject(fullOld, fullNew);
      await this.prisma.userFile.updateMany({
        where: { filePath: fullOld, userId },
        data: { filePath: fullNew, fileName: newPath },
      });
    }
    return { success: true, newPath: relativeNew };
  }

  // ========== [私有辅助方法] ==========

  /**
   * 构建资源的完整路径
   * @param dto 资源 DTO 对象
   * @param isFolder 是否为文件夹
   * @returns 完整路径字符串
   */
  private buildFullPath(dto: any, isFolder: boolean): string {
    const { userId, courseId, parentPath, resourceName } = dto;
    const base = courseId ? `public/${userId}/${courseId}` : `users/${userId}`;
    const sub = parentPath ? `${parentPath}/${resourceName}` : resourceName;
    return this.formatPath(`${base}/${sub}`, isFolder);
  }

  /**
   * 从 COS 获取资源并映射为统一格式
   * @param prefix COS 前缀路径
   * @param userId 用户ID
   * @param basePath 基础路径
   * @param isPublic 是否为公共资源
   * @returns 格式化后的资源列表
   */
  private async fetchAndMapResources(
    prefix: string,
    userId: number,
    basePath: string,
    isPublic: boolean,
  ) {
    const result = await this.execCosAction('getBucket', {
      Bucket: this.bucket,
      Region: this.region,
      Prefix: prefix,
      Delimiter: '/',
    });
    const cosPaths = [
      ...(result.Contents || []).map((i) => i.Key),
      ...(result.CommonPrefixes || []).map((i) => i.Prefix),
    ];
    const dbRecords = await this.prisma.userFile.findMany({
      where: { filePath: { in: cosPaths }, userId },
    });
    const dbMap = new Map(
      dbRecords.map((r) => [decodeURIComponent(r.filePath), r]),
    );

    const mapItem = (
      key: string,
      type: 'FOLDER' | 'FILE',
      size?: number,
      date?: string,
    ) => {
      const decodedKey = decodeURIComponent(key);
      const db = dbMap.get(decodedKey);
      return {
        id: db?.id || null,
        resourceName:
          type === 'FOLDER'
            ? decodedKey.split('/').filter(Boolean).pop()
            : decodedKey.split('/').pop(),
        resourcePath: decodedKey.replace(`${basePath}/`, ''),
        resourceType: type,
        fileSize:
          db?.fileSize ||
          (size ? `${(size / 1024 / 1024).toFixed(2)}MB` : null),
        fileFormat:
          db?.fileFormat ||
          (type === 'FILE' ? decodedKey.split('.').pop()?.toUpperCase() : null),
        createdAt: db?.createdAt || (date ? new Date(date) : new Date()),
        isPublic,
      };
    };

    return [
      ...(result.CommonPrefixes || []).map((f) => mapItem(f.Prefix, 'FOLDER')),
      ...(result.Contents || [])
        .filter((i) => !i.Key.endsWith('/'))
        .map((i) => mapItem(i.Key, 'FILE', i.Size, i.LastModified)),
    ];
  }

  /**
   * 内部删除 COS 资源的方法
   * @param fullPath 完整路径
   */
  private async internalCosDelete(fullPath: string): Promise<void> {
    if (fullPath.endsWith('/')) {
      const list = await this.execCosAction('getBucket', {
        Bucket: this.bucket,
        Region: this.region,
        Prefix: fullPath,
      });
      const objects = (list.Contents || []).map((item) => ({ Key: item.Key }));
      if (objects.length)
        await this.execCosAction('deleteMultipleObject', {
          Bucket: this.bucket,
          Region: this.region,
          Objects: objects,
        });
    } else {
      await this.execCosAction('deleteObject', {
        Bucket: this.bucket,
        Region: this.region,
        Key: fullPath,
      });
    }
  }

  /**
   * 获取用于上传的签名 URL
   * @param path 资源路径
   * @returns 上传 URL
   */
  private async getSignedUrlForUpload(path: string) {
    const auth = this.cosClient.getAuth({
      Method: 'PUT',
      Key: path,
      Expires: 3600,
      Bucket: this.bucket,
      Region: this.region,
    });
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${path}?${auth}`;
  }

  /**
   * 移动单个 COS 对象（先复制后删除）
   * @param oldKey 旧键名
   * @param newKey 新键名
   */
  private async moveSingleObject(oldKey: string, newKey: string) {
    await this.execCosAction('putObjectCopy', {
      Bucket: this.bucket,
      Region: this.region,
      Key: newKey,
      CopySource: `${this.bucket}.cos.${this.region}.myqcloud.com/${encodeURIComponent(oldKey)}`,
    });
    await this.execCosAction('deleteObject', {
      Bucket: this.bucket,
      Region: this.region,
      Key: oldKey,
    });
  }

  /**
   * 执行 COS SDK 操作的通用方法
   * @param action 操作名称
   * @param params 参数对象
   * @returns Promise 结果
   */
  private execCosAction(action: string, params: any): Promise<any> {
    return new Promise((res, rej) =>
      this.cosClient[action](params, (err, data) =>
        err ? rej(err) : res(data),
      ),
    );
  }

  /**
   * 格式化路径，确保安全性和一致性
   * @param path 原始路径
   * @param isFolder 是否为文件夹
   * @returns 格式化后的路径
   */
  private formatPath(path: string, isFolder: boolean): string {
    if (path.includes('../') || path.includes('..\\'))
      throw new HttpException('非法路径', 400);
    let clean = path.replace(/\/+$/, '').startsWith('/')
      ? path.substring(1)
      : path;
    return isFolder
      ? `${clean.replace(/\/+$/, '')}/`
      : clean.replace(/\/+$/, '');
  }
}