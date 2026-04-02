import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as COS from 'cos-nodejs-sdk-v5';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateTencentCoDto,
  BindResourceDto,
} from './dto/create-tencent-co.dto';

@Injectable()
export class TencentCosService {
  private cosClient: COS;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretId = this.configService.get('TENCENT_COS_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_COS_SECRET_KEY');
    this.bucket = this.configService.get('TENCENT_COS_BUCKET');
    this.region = this.configService.get('TENCENT_COS_REGION');

    if (!secretId || !secretKey || !this.bucket || !this.region) {
      throw new Error('Tencent COS 配置不完整，请检查环境变量');
    }

    this.cosClient = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });
  }

  // ========== [创建操作] ==========

  /**
   * 创建用户文件夹（学生个人端和教师端）
   */
  async createUserFolder(createDto: CreateTencentCoDto): Promise<any> {
    const { resourceName, parentPath, userId, courseId } = createDto;
    if (!userId) throw new BadRequestException('必须提供用户ID');

    let folderPath: string;
    if (!courseId) {
      folderPath = this.formatPath(
        parentPath
          ? `users/${userId}/${parentPath}/${resourceName}`
          : `users/${userId}/${resourceName}`,
        true,
      );
    } else {
      folderPath = this.formatPath(
        parentPath
          ? `public/${userId}/${courseId}/${parentPath}/${resourceName}`
          : `public/${userId}/${courseId}/${resourceName}`,
        true,
      );
    }

    try {
      await this.execCosAction('putObject', {
        Bucket: this.bucket,
        Region: this.region,
        Key: folderPath,
        Body: '',
      });

      return await this.prisma.userFile.create({
        data: {
          fileName: resourceName,
          filePath: folderPath,
          isFolder: true,
          userId: userId,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `创建文件夹失败: ${error.message}`,
      );
    }
  }

  /**
   * 生成用户文件上传链接（学生个人端和教师端）
   */
  async createUserFile(createDto: CreateTencentCoDto): Promise<any> {
    const { resourceName, parentPath, fileSize, fileFormat, userId, courseId } =
      createDto;
    if (!userId) throw new BadRequestException('必须提供用户ID');

    let filePath: string;
    if (!courseId) {
      filePath = this.formatPath(
        parentPath
          ? `users/${userId}/${parentPath}/${resourceName}`
          : `users/${userId}/${resourceName}`,
        false,
      );
    } else {
      filePath = this.formatPath(
        parentPath
          ? `public/${userId}/${courseId}/${parentPath}/${resourceName}`
          : `public/${userId}/${courseId}/${resourceName}`,
        false,
      );
    }

    const uploadUrl = await this.getSignedUrlForUpload(filePath);

    return await this.prisma.userFile
      .create({
        data: {
          fileName: resourceName,
          filePath: filePath,
          fileSize: fileSize || null,
          fileFormat: fileFormat || null,
          isFolder: false,
          userId: userId,
        },
      })
      .then((record) => ({ ...record, uploadUrl }));
  }

  /**
   * 创建或更新教学资源（教师课程端）
   * 修复点：
   * 1. 针对所有类型执行 Upsert（更新或创建）逻辑。
   * 2. 若路径发生变化，调用 internalCosDelete 清理 COS 上的旧文件。
   */
  async createCourseResource(createDto: BindResourceDto): Promise<any> {
    const { resourceName, nodeId, resourceType, fileSize, fileFormat } =
      createDto;

    // 1. 校验节点
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) {
      throw new BadRequestException(`知识节点不存在: nodeId=${nodeId}`);
    }

    // 2. 构建新资源路径
    // 建议在路径中加入资源类型（如 resources/1/video/test.mp4），防止不同类型文件同名覆盖
    const newResourcePath = this.formatPath(
      `resources/${nodeId}/${resourceType.toLowerCase()}/${resourceName}`,
      false,
    );

    // 3. 查找该节点下同类型的旧资源记录
    const existingResource = await this.prisma.resource.findFirst({
      where: {
        nodeId: nodeId,
        resourceType: resourceType,
      },
    });

    if (existingResource) {
      // 只有当新上传的文件路径与数据库记录的路径不一致时，才需要删除旧文件
      // 如果路径完全一致，接下来的 PUT 操作会自动覆盖 COS 上的对象
      if (existingResource.resourcePath !== newResourcePath) {
        try {
          // 私有删除方法
          await this.internalCosDelete(existingResource.resourcePath);
          console.log(
            `已物理删除 COS 旧资源: ${existingResource.resourcePath}`,
          );
        } catch (error) {
          // 记录警告但不中断流程（防止因文件已被手动删除导致的接口崩溃）
          console.warn(
            `清理 COS 旧文件失败 (可能文件已不存在): ${error.message}`,
          );
        }
      }
    }

    // 5. 获取上传签名
    const uploadUrl = await this.getSignedUrlForUpload(newResourcePath);

    const commonData = {
      resourceName: resourceName,
      resourcePath: newResourcePath,
      fileSize: fileSize || null,
      fileFormat: fileFormat || null,
    };

    let record;
    if (existingResource) {
      // 执行更新记录
      record = await this.prisma.resource.update({
        where: { id: existingResource.id },
        data: commonData,
      });
    } else {
      // 执行创建记录
      record = await this.prisma.resource.create({
        data: {
          ...commonData,
          resourceType: resourceType,
          nodeId: nodeId,
        },
      });
    }

    return { ...record, uploadUrl };
  }

  // ========== [读取操作，用户] ==========

  async listUserDirectory(userId: number, path: string = ''): Promise<any> {
    // 首先获取用户信息以判断角色
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const userBasePath = `users/${userId}`;
    const userPrefix = this.formatPath(
      path ? `${userBasePath}/${path}` : userBasePath,
      true,
    );

    try {
      // 获取个人资源
      const userResult = await this.execCosAction('getBucket', {
        Bucket: this.bucket,
        Region: this.region,
        Prefix: userPrefix,
        Delimiter: '/',
      });

      const userCosPaths = [
        ...(userResult.Contents || []).map((i) => i.Key),
        ...(userResult.CommonPrefixes || []).map((i) => i.Prefix),
      ];

      const userDbRecords = await this.prisma.userFile.findMany({
        where: { filePath: { in: userCosPaths }, userId },
      });
      const userDbMap = new Map(userDbRecords.map((r) => [r.filePath, r]));

      const userFolders = (userResult.CommonPrefixes || []).map((f) => {
        const db = userDbMap.get(f.Prefix);
        return {
          id: db?.id || null,
          resourceName: f.Prefix.split('/').filter(Boolean).pop(),
          resourcePath: f.Prefix.replace(`${userBasePath}/`, ''),
          resourceType: 'FOLDER',
          createdAt: db?.createdAt || new Date(),
          isPublic: false, // 个人资源为私有
        };
      });

      const userFiles = (userResult.Contents || [])
        .filter((i) => !i.Key.endsWith('/'))
        .map((i) => {
          const db = userDbMap.get(i.Key);
          return {
            id: db?.id || null,
            resourceName: i.Key.split('/').pop(),
            resourcePath: i.Key.replace(`${userBasePath}/`, ''),
            resourceType: 'FILE',
            fileSize: db?.fileSize || `${(i.Size / 1024 / 1024).toFixed(2)}MB`,
            fileFormat: db?.fileFormat || i.Key.split('.').pop(),
            createdAt: db?.createdAt || new Date(i.LastModified),
            isPublic: false, // 个人资源为私有
          };
        });

      let allResources = [...userFolders, ...userFiles];

      // 如果是学生且在根目录，还需要获取所有已加入课程的根目录公共资源
      if (user.role === 'student' && path === '') {
        // 通过隐式中间表找到学生加入的所有课程（只查询根节点）
        const enrolledCourses = await this.prisma.node.findMany({
          where: {
            students: { some: { id: userId } },
            parentNodeId: null, // 只获取根节点（课程）
          } as any,
          select: { id: true, creatorId: true },
        });

        // 并行获取所有课程根目录的资源
        const courseResourcesPromises = enrolledCourses.map(async (course) => {
          if (!course.creatorId) {
            return [];
          }

          const basePath = `public/${course.creatorId}/${course.id}`;
          const prefix = this.formatPath(basePath, true);

          try {
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
              where: { filePath: { in: cosPaths }, userId: course.creatorId },
            });
            const dbMap = new Map(dbRecords.map((r) => [r.filePath, r]));

            const folders = (result.CommonPrefixes || []).map((f) => {
              const db = dbMap.get(f.Prefix);
              return {
                id: db?.id || null,
                resourceName: f.Prefix.split('/').filter(Boolean).pop(),
                resourcePath: f.Prefix.replace(`${basePath}/`, ''),
                resourceType: 'FOLDER',
                createdAt: db?.createdAt || new Date(),
                isPublic: true, // 课程资源为公有
              };
            });

            const files = (result.Contents || [])
              .filter((i) => !i.Key.endsWith('/'))
              .map((i) => {
                const db = dbMap.get(i.Key);
                return {
                  id: db?.id || null,
                  resourceName: i.Key.split('/').pop(),
                  resourcePath: i.Key.replace(`${basePath}/`, ''),
                  resourceType: 'FILE',
                  fileSize:
                    db?.fileSize || `${(i.Size / 1024 / 1024).toFixed(2)}MB`,
                  fileFormat: db?.fileFormat || i.Key.split('.').pop(),
                  createdAt: db?.createdAt || new Date(i.LastModified),
                  isPublic: true, // 课程资源为公有
                };
              });

            return [...folders, ...files];
          } catch (error) {
            // 单个课程获取失败不影响其他课程
            console.error(`获取课程 ${course.id} 资源失败:`, error.message);
            return [];
          }
        });

        const allCourseResources = await Promise.all(courseResourcesPromises);
        const flattenedCourseResources = allCourseResources.flat();
        allResources = [...allResources, ...flattenedCourseResources];
      }

      return allResources;
    } catch (error) {
      throw new BadRequestException(`获取列表失败: ${error.message}`);
    }
  }

  // ========== [读取操作，课程] ==========

  async listCourseDirectory(
    userId: number,
    path: string = '',
    courseId: number,
  ): Promise<any> {
    // 教师直接使用自己的ID构建课程资源路径
    const basePath = `public/${userId}/${courseId}`;

    const prefix = this.formatPath(
      path ? `${basePath}/${path}` : basePath,
      true,
    );

    try {
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

      // 查询数据库记录，使用教师的userId
      const dbRecords = await this.prisma.userFile.findMany({
        where: { filePath: { in: cosPaths }, userId },
      });
      const dbMap = new Map(dbRecords.map((r) => [r.filePath, r]));

      const folders = (result.CommonPrefixes || []).map((f) => {
        const db = dbMap.get(f.Prefix);
        return {
          id: db?.id || null,
          resourceName: f.Prefix.split('/').filter(Boolean).pop(),
          resourcePath: f.Prefix.replace(`${basePath}/`, ''),
          resourceType: 'FOLDER',
          createdAt: db?.createdAt || new Date(),
        };
      });

      const files = (result.Contents || [])
        .filter((i) => !i.Key.endsWith('/'))
        .map((i) => {
          const db = dbMap.get(i.Key);
          return {
            id: db?.id || null,
            resourceName: i.Key.split('/').pop(),
            resourcePath: i.Key.replace(`${basePath}/`, ''),
            resourceType: 'FILE',
            fileSize: db?.fileSize || `${(i.Size / 1024 / 1024).toFixed(2)}MB`,
            fileFormat: db?.fileFormat || i.Key.split('.').pop(),
            createdAt: db?.createdAt || new Date(i.LastModified),
          };
        });

      return [...folders, ...files];
    } catch (error) {
      throw new BadRequestException(`获取列表失败: ${error.message}`);
    }
  }

  async getSignedUrl(
    nodeId: number,
    method: string = 'GET',
    expireTime: number = 3600,
    resourceType?: 'PPT' | 'VIDEO' | 'PDF',
  ): Promise<string> {
    const whereCondition: any = { nodeId };
    if (resourceType) whereCondition.resourceType = resourceType;

    const resource = await this.prisma.resource.findFirst({
      where: whereCondition,
    });
    if (!resource) throw new NotFoundException(`资源不存在`);

    const authorization = this.cosClient.getAuth({
      Method: method.toUpperCase() as COS.Method,
      Key: resource.resourcePath,
      Expires: expireTime,
      Bucket: this.bucket,
      Region: this.region,
    });

    let url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${resource.resourcePath}?${authorization}`;
    const isMedia = /\.(mp4|webm|ogg|mp3|wav|mov)$/i.test(
      resource.resourcePath,
    );

    if (!isMedia) {
      const fileName = resource.resourcePath.split('/').pop() || '';
      url += `&response-content-disposition=inline;filename="${encodeURIComponent(fileName)}"`;
    }
    return url;
  }

  /**

   * 批量获取多个资源的预签名 URL

   * @param nodeIds 资源节点ID数组

   * @param method HTTP请求方法，默认get

   * @param expireTime 签名过期时间（秒），默认3600秒

   * @returns 预签名URL数组

   */

  async getMultipleSignedUrls(
    nodeIds: number[],

    method: 'get' | 'post' | 'put' | 'delete' = 'get',

    expireTime: number = 3600,
  ): Promise<string[]> {
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

    // 2. 查询资源路径并校验

    const keyResults = await this.prisma.resource.findMany({
      where: {
        nodeId: {
          in: nodeIds,
        },
      },

      select: { nodeId: true, resourcePath: true },
    });

    if (!keyResults || keyResults.length === 0) {
      throw new Error(`未找到任何nodeId对应的资源路径`);
    }

    // 检查是否所有传入的nodeId都存在

    const foundNodeIds = keyResults.map((result) => result.nodeId);

    const missingNodeIds = nodeIds.filter((id) => !foundNodeIds.includes(id));

    if (missingNodeIds.length > 0) {
      throw new Error(
        `未找到以下nodeId对应的资源路径: ${missingNodeIds.join(', ')}`,
      );
    }

    // 3. 为每个资源生成预签名URL

    const urls: string[] = [];

    for (const keyResult of keyResults) {
      const originalKey = keyResult.resourcePath;

      // 提取文件名用于响应头（仅编码文件名，避免中文乱码）

      const fileName = originalKey.split('/').pop() || '';

      const encodedFileName = encodeURIComponent(fileName);

      try {
        // 直接调用getAuth（同步方法，返回签名字符串）

        const authorization = this.cosClient.getAuth({
          Method: method.toUpperCase() as COS.Method, // 确保类型匹配

          Key: originalKey, // 原始Key（带空格，SDK自动处理编码）

          Expires: expireTime,

          Bucket: bucket,

          Region: region,
        });

        // 构建完整的预签名URL

        if (!authorization) {
          throw new Error('COS未返回有效的预签名URL');
        }

        const url = `https://${bucket}.cos.${region}.myqcloud.com/${originalKey}?${authorization}&response-content-disposition=inline%3B%20filename%3D%22${encodedFileName}%22`;

        urls.push(url);
      } catch (error) {
        console.error('COS生成签名失败:', {
          error: error.message || error,

          nodeId: keyResult.nodeId,

          originalKey,

          bucket,

          region,

          secretId: secretId.substring(0, 10) + '...', // 脱敏展示
        });

        throw new Error(
          `COS签名生成失败：${error.message || JSON.stringify(error)}，节点ID: ${keyResult.nodeId}`,
        );
      }
    }

    // 根据原始nodeIds顺序排序结果

    return urls;
  }

  // ========== [更新与删除：核心部分] ==========

  /**
   * 学生端：删除个人资源
   * 保持原有参数: userId 和 resourcePath
   */
  async deleteUserResource(
    userId: number,
    resourcePath: string,
    courseId?: number,
  ): Promise<any> {
    const isFolder = resourcePath.endsWith('/');

    let fullPath: string;
    if (!courseId) {
      fullPath = this.formatPath(`users/${userId}/${resourcePath}`, isFolder);
    } else {
      fullPath = this.formatPath(
        `public/${userId}/${courseId}/${resourcePath}`,
        isFolder,
      );
    }

    try {
      // 1. 调用通用删除逻辑
      await this.internalCosDelete(fullPath);

      // 2. 数据库同步处理
      if (isFolder) {
        await this.prisma.userFile.deleteMany({
          where: { filePath: { startsWith: fullPath }, userId },
        });
      } else {
        await this.prisma.userFile.deleteMany({
          where: { filePath: fullPath, userId },
        });
      }
      return { success: true };
    } catch (error) {
      throw new BadRequestException(`删除失败: ${error.message}`);
    }
  }

  /**
   * 学生端：重命名资源
   * 保持原有参数
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
    const cleanOldPath = oldPath.replace(/\/+$/, '');

    let relativeNewPath = newPath.includes('/')
      ? newPath
      : [...cleanOldPath.split('/').slice(0, -1), newPath].join('/');

    const fullOldPath = this.formatPath(`${basePath}/${oldPath}`, isFolder);
    const fullNewPath = this.formatPath(
      `${basePath}/${relativeNewPath}`,
      isFolder,
    );

    if (fullOldPath === fullNewPath) return { success: true };

    try {
      if (isFolder) {
        const list = await this.execCosAction('getBucket', {
          Bucket: this.bucket,
          Region: this.region,
          Prefix: fullOldPath,
        });
        for (const item of list.Contents || []) {
          const newKey = item.Key.replace(fullOldPath, fullNewPath);
          await this.moveSingleObject(item.Key, newKey);
        }
        const allRelatedFiles = await this.prisma.userFile.findMany({
          where: { filePath: { startsWith: fullOldPath }, userId },
        });
        await Promise.all(
          allRelatedFiles.map((file) =>
            this.prisma.userFile.update({
              where: { id: file.id },
              data: {
                filePath: file.filePath.replace(fullOldPath, fullNewPath),
                ...(file.filePath === fullOldPath
                  ? { fileName: newPath.replace(/\/$/, '') }
                  : {}),
              },
            }),
          ),
        );
      } else {
        await this.moveSingleObject(fullOldPath, fullNewPath);
        await this.prisma.userFile.updateMany({
          where: { filePath: fullOldPath, userId },
          data: { filePath: fullNewPath, fileName: newPath },
        });
      }
      return { success: true, newPath: relativeNewPath };
    } catch (error) {
      throw new BadRequestException(`重命名失败: ${error.message}`);
    }
  }

  // ========== [辅助私有方法] ==========

  /**
   * 内部通用：物理删除 COS 文件（支持文件/目录）
   */
  private async internalCosDelete(fullPath: string): Promise<void> {
    const isFolder = fullPath.endsWith('/');
    if (isFolder) {
      const list = await this.execCosAction('getBucket', {
        Bucket: this.bucket,
        Region: this.region,
        Prefix: fullPath,
      });
      const objects = (list.Contents || []).map((item) => ({ Key: item.Key }));
      if (objects.length > 0) {
        await this.execCosAction('deleteMultipleObject', {
          Bucket: this.bucket,
          Region: this.region,
          Objects: objects,
        });
      }
    } else {
      await this.execCosAction('deleteObject', {
        Bucket: this.bucket,
        Region: this.region,
        Key: fullPath,
      });
    }
  }

  private async getSignedUrlForUpload(resourcePath: string): Promise<string> {
    const auth = this.cosClient.getAuth({
      Method: 'PUT',
      Key: resourcePath,
      Expires: 3600,
      Bucket: this.bucket,
      Region: this.region,
    });
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${resourcePath}?${auth}`;
  }

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

  private async execCosAction(action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.cosClient[action](params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private formatPath(path: string, isFolder: boolean): string {
    if (path.includes('../') || path.includes('..\\'))
      throw new BadRequestException('非法的路径');
    let cleanPath = path.replace(/\/+$/, '');
    if (isFolder) cleanPath += '/';
    return cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
  }
}
