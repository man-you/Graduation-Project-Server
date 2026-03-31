import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as COS from 'cos-nodejs-sdk-v5';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTencentCoDto } from './dto/create-tencent-co.dto';

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
   * 创建文件夹（仅在COS中创建，不存储到数据库）
   * @param createDto 文件夹创建DTO
   * @returns 创建的文件夹信息
   */
  async createFolder(createDto: CreateTencentCoDto) {
    const { resourceName, parentPath } = createDto;

    // 验证是否为文件夹类型
    if (createDto.resourceType !== 'FOLDER') {
      throw new BadRequestException('资源类型必须为FOLDER');
    }

    // 构建文件夹路径
    const folderPath = parentPath
      ? `${parentPath}/${resourceName}/`
      : `${resourceName}/`;

    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 在COS中创建文件夹（通过上传空对象）
      await new Promise((resolve, reject) => {
        this.cosClient.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: folderPath,
            Body: '',
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      return {
        resourceName,
        resourcePath: folderPath,
        resourceType: 'FOLDER',
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('创建文件夹失败:', error);
      throw new BadRequestException(`创建文件夹失败: ${error.message}`);
    }
  }

  /**
   * 上传文件（返回上传URL，前端实际上传）
   * @param createDto 文件创建DTO
   * @returns 文件信息和上传URL
   */
  async createFile(createDto: CreateTencentCoDto) {
    const { resourceName, parentPath, fileSize, fileFormat } = createDto;

    // 验证是否为文件类型
    if (createDto.resourceType !== 'FILE') {
      throw new BadRequestException('资源类型必须为FILE');
    }

    // 构建文件路径
    const filePath = parentPath
      ? `${parentPath}/${resourceName}`
      : resourceName;

    // 生成上传预签名URL
    const uploadUrl = await this.getSignedUrlForUpload(filePath);

    return {
      resourceName,
      resourcePath: filePath,
      resourceType: 'FILE',
      fileSize: fileSize || null,
      fileFormat: fileFormat || null,
      uploadUrl,
      createdAt: new Date(),
    };
  }

  /**
   * 创建用户文件夹
   * @param createDto 文件夹创建DTO（包含userId）
   * @returns 创建的文件夹信息
   */
  async createUserFolder(createDto: CreateTencentCoDto) {
    const { resourceName, parentPath, userId } = createDto;

    if (!userId) {
      throw new BadRequestException('必须提供用户ID');
    }

    // 验证是否为文件夹类型
    if (createDto.resourceType !== 'FOLDER') {
      throw new BadRequestException('资源类型必须为FOLDER');
    }

    // 构建用户专属文件夹路径
    const userBasePath = `users/${userId}`;
    const folderPath = parentPath
      ? `${userBasePath}/${parentPath}/${resourceName}/`
      : `${userBasePath}/${resourceName}/`;

    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 在COS中创建文件夹（通过上传空对象）
      await new Promise((resolve, reject) => {
        this.cosClient.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: folderPath,
            Body: '',
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      // 在数据库中记录文件夹信息
      const folderRecord = await this.prisma.userFile.create({
        data: {
          fileName: resourceName,
          filePath: folderPath,
          isFolder: true,
          userId: userId,
        },
      });

      return {
        id: folderRecord.id,
        resourceName: folderRecord.fileName,
        resourcePath: folderRecord.filePath,
        resourceType: 'FOLDER',
        userId: folderRecord.userId,
        createdAt: folderRecord.createdAt,
      };
    } catch (error) {
      console.error('创建用户文件夹失败:', error);
      throw new BadRequestException(`创建用户文件夹失败: ${error.message}`);
    }
  }

  /**
   * 上传用户文件
   * @param createDto 文件创建DTO（包含userId）
   * @returns 文件信息和上传URL
   */
  async createUserFile(createDto: CreateTencentCoDto) {
    const { resourceName, parentPath, fileSize, fileFormat, userId } =
      createDto;

    if (!userId) {
      throw new BadRequestException('必须提供用户ID');
    }

    // 验证是否为文件类型
    if (createDto.resourceType !== 'FILE') {
      throw new BadRequestException('资源类型必须为FILE');
    }

    // 构建用户专属文件路径
    const userBasePath = `users/${userId}`;
    const filePath = parentPath
      ? `${userBasePath}/${parentPath}/${resourceName}`
      : `${userBasePath}/${resourceName}`;

    // 生成上传预签名URL
    const uploadUrl = await this.getSignedUrlForUpload(filePath);

    // 在数据库中记录文件信息
    const fileRecord = await this.prisma.userFile.create({
      data: {
        fileName: resourceName,
        filePath: filePath,
        fileSize: fileSize || null,
        fileFormat: fileFormat || null,
        isFolder: false,
        userId: userId,
      },
    });

    return {
      id: fileRecord.id,
      resourceName: fileRecord.fileName,
      resourcePath: fileRecord.filePath,
      resourceType: 'FILE',
      fileSize: fileRecord.fileSize,
      fileFormat: fileRecord.fileFormat,
      userId: fileRecord.userId,
      uploadUrl,
      createdAt: fileRecord.createdAt,
    };
  }

  /**
   * 获取用于上传的预签名URL
   * @param resourcePath 资源路径
   * @param expireTime 过期时间（秒）
   * @returns 预签名URL
   */
  private async getSignedUrlForUpload(
    resourcePath: string,
    expireTime: number = 3600,
  ): Promise<string> {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');
    const secretId = this.configService.get('TENCENT_COS_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_COS_SECRET_KEY');

    if (!bucket || !region || !secretId || !secretKey) {
      throw new Error('COS配置不完整');
    }

    try {
      // 使用getAuth生成签名
      const authorization = this.cosClient.getAuth({
        Method: 'PUT',
        Key: resourcePath,
        Expires: expireTime,
        Bucket: bucket,
        Region: region,
      });

      if (!authorization) {
        throw new Error('COS未返回有效的预签名URL');
      }

      return `https://${bucket}.cos.${region}.myqcloud.com/${resourcePath}?${authorization}`;
    } catch (error) {
      console.error('生成上传签名失败:', error);
      throw new Error(`生成上传签名失败: ${error.message}`);
    }
  }

  /**
   * 读取目录内容（列出文件和文件夹）
   * @param path 目录路径，为空时表示根目录
   * @returns 目录内容列表
   */
  async listDirectory(path: string = '') {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 使用COS的getBucket方法列出目录内容
      const prefix = path ? (path.endsWith('/') ? path : `${path}/`) : '';

      const result = await new Promise<any>((resolve, reject) => {
        this.cosClient.getBucket(
          {
            Bucket: bucket,
            Region: region,
            Prefix: prefix,
            Delimiter: '/', // 使用分隔符来区分文件夹和文件
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      const contents = result.Contents || [];
      const commonPrefixes = result.CommonPrefixes || [];

      // 处理文件
      const files = contents
        .map((item: any) => {
          // 跳过以/结尾的对象（这些是文件夹标记）
          if (item.Key.endsWith('/')) {
            return null;
          }

          const resourceName = item.Key.substring(prefix.length);
          const fileFormat = resourceName.includes('.')
            ? resourceName.split('.').pop()
            : '';

          return {
            resourceName,
            resourcePath: item.Key,
            resourceType: 'FILE',
            fileSize: item.Size
              ? `${(Number(item.Size) / 1024 / 1024).toFixed(2)}MB`
              : null,
            fileFormat: fileFormat || null,
            createdAt: new Date(item.LastModified),
          };
        })
        .filter(Boolean);

      // 处理文件夹
      const folders = commonPrefixes.map((prefixItem: any) => {
        const folderName = prefixItem.Prefix.substring(prefix.length);
        const folderPath = prefixItem.Prefix;

        return {
          resourceName: folderName.replace('/', ''),
          resourcePath: folderPath,
          resourceType: 'FOLDER',
          fileSize: null,
          fileFormat: null,
          createdAt: new Date(),
        };
      });

      return [...folders, ...files];
    } catch (error) {
      console.error('列出目录内容失败:', error);
      throw new BadRequestException(`列出目录内容失败: ${error.message}`);
    }
  }

  /**
   * 列出用户的目录内容
   * @param userId 用户ID
   * @param path 目录路径，为空时表示根目录
   * @returns 目录内容列表
   */
  async listUserDirectory(userId: number, path: string = '') {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 构建用户专属路径前缀
      const userBasePath = `users/${userId}`;
      const prefix = path ? `${userBasePath}/${path}/` : `${userBasePath}/`;

      // 使用COS的getBucket方法列出目录内容
      const result = await new Promise<any>((resolve, reject) => {
        this.cosClient.getBucket(
          {
            Bucket: bucket,
            Region: region,
            Prefix: prefix,
            Delimiter: '/', // 使用分隔符来区分文件夹和文件
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      const contents = result.Contents || [];
      const commonPrefixes = result.CommonPrefixes || [];

      // 处理文件
      const files = await Promise.all(
        contents.map(async (item: any) => {
          // 跳过以/结尾的对象（这些是文件夹标记）
          if (item.Key.endsWith('/')) {
            return null;
          }

          const relativePath = item.Key.substring(userBasePath.length + 1);
          const resourceName = relativePath.includes('/')
            ? relativePath.substring(relativePath.lastIndexOf('/') + 1)
            : relativePath;
          const fileFormat = resourceName.includes('.')
            ? resourceName.split('.').pop()
            : '';

          // 查找数据库中的文件记录
          const dbFile = await this.prisma.userFile.findFirst({
            where: {
              filePath: item.Key,
              userId: userId,
            },
          });

          if (dbFile) {
            return {
              id: dbFile.id,
              resourceName: dbFile.fileName,
              resourcePath: relativePath,
              resourceType: 'FILE',
              fileSize: dbFile.fileSize,
              fileFormat: dbFile.fileFormat,
              userId: dbFile.userId,
              createdAt: dbFile.createdAt,
            };
          }

          // 如果数据库中没有记录，创建临时记录
          return {
            id: null,
            resourceName,
            resourcePath: relativePath,
            resourceType: 'FILE',
            fileSize: item.Size
              ? `${(Number(item.Size) / 1024 / 1024).toFixed(2)}MB`
              : null,
            fileFormat: fileFormat || null,
            userId,
            createdAt: new Date(item.LastModified),
          };
        }),
      ).then((files) => files.filter(Boolean));

      // 处理文件夹
      const folders = await Promise.all(
        commonPrefixes.map(async (prefixItem: any) => {
          const relativePath = prefixItem.Prefix.substring(
            userBasePath.length + 1,
          );
          const folderName = relativePath.replace('/', '');

          // 查找数据库中的文件夹记录
          const dbFolder = await this.prisma.userFile.findFirst({
            where: {
              filePath: prefixItem.Prefix,
              userId: userId,
              isFolder: true,
            },
          });

          if (dbFolder) {
            return {
              id: dbFolder.id,
              resourceName: dbFolder.fileName,
              resourcePath: relativePath,
              resourceType: 'FOLDER',
              fileSize: null,
              fileFormat: null,
              userId: dbFolder.userId,
              createdAt: dbFolder.createdAt,
            };
          }

          return {
            id: null,
            resourceName: folderName,
            resourcePath: relativePath,
            resourceType: 'FOLDER',
            fileSize: null,
            fileFormat: null,
            userId,
            createdAt: new Date(),
          };
        }),
      );

      return [...folders, ...files];
    } catch (error) {
      console.error('列出用户目录内容失败:', error);
      throw new BadRequestException(`列出用户目录内容失败: ${error.message}`);
    }
  }

  /**
   * 重命名文件或文件夹
   * @param oldPath 原路径
   * @param newPath 新路径（可以是完整路径或仅文件名）
   * @returns 重命名结果
   */
  async renameResource(oldPath: string, newPath: string) {
    // 处理newPath：如果newPath不包含'/'，则保持在oldPath的同一目录下
    let finalNewPath = newPath;
    if (!newPath.includes('/')) {
      // newPath只是文件名，需要保持在oldPath的目录中
      const oldDir = oldPath.includes('/')
        ? oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
        : '';
      finalNewPath = oldDir + newPath;
    }

    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 检查原路径是否存在
      const exists = await this.checkObjectExists(oldPath);
      if (!exists) {
        throw new NotFoundException(`资源 ${oldPath} 不存在`);
      }

      // 如果新路径已存在，先删除它（允许覆盖）
      const newExists = await this.checkObjectExists(finalNewPath);
      if (newExists) {
        // 删除已存在的目标文件/文件夹
        if (finalNewPath.endsWith('/')) {
          await this.deleteFolder(finalNewPath);
        } else {
          await new Promise((resolve, reject) => {
            this.cosClient.deleteObject(
              {
                Bucket: bucket,
                Region: region,
                Key: finalNewPath,
              },
              (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              },
            );
          });
        }
      }

      // 复制对象到新路径
      await new Promise((resolve, reject) => {
        this.cosClient.putObjectCopy(
          {
            Bucket: bucket,
            Region: region,
            Key: finalNewPath,
            CopySource: `${bucket}.cos.${region}.myqcloud.com/${encodeURIComponent(oldPath)}`,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      // 删除原对象
      await new Promise((resolve, reject) => {
        this.cosClient.deleteObject(
          {
            Bucket: bucket,
            Region: region,
            Key: oldPath,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      return { success: true, message: '重命名成功' };
    } catch (error) {
      console.error('重命名资源失败:', error);
      throw new BadRequestException(`重命名资源失败: ${error.message}`);
    }
  }

  /**
   * 重命名用户的文件或文件夹
   * @param userId 用户ID
   * @param oldPath 原相对路径
   * @param newPath 新相对路径（可以是完整路径或仅文件名）
   * @returns 重命名结果
   */
  async renameUserResource(userId: number, oldPath: string, newPath: string) {
    const userBasePath = `users/${userId}`;

    // 处理newPath：如果newPath不包含'/'，则保持在oldPath的同一目录下
    let finalNewPath = newPath;
    if (!newPath.includes('/')) {
      // newPath只是文件名，需要保持在oldPath的目录中
      const oldDir = oldPath.includes('/')
        ? oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
        : '';
      finalNewPath = oldDir + newPath;
    }

    const fullOldPath = `${userBasePath}/${oldPath}`;
    const fullNewPath = `${userBasePath}/${finalNewPath}`;

    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 检查原路径是否存在且属于该用户
      const exists = await this.checkObjectExists(fullOldPath);
      if (!exists) {
        throw new NotFoundException(`资源 ${oldPath} 不存在`);
      }

      // 如果新路径已存在，先删除它（允许覆盖）
      const newExists = await this.checkObjectExists(fullNewPath);
      if (newExists) {
        // 删除已存在的目标文件/文件夹
        if (fullNewPath.endsWith('/')) {
          await this.deleteUserFolder(userId, fullNewPath);
        } else {
          await new Promise((resolve, reject) => {
            this.cosClient.deleteObject(
              {
                Bucket: bucket,
                Region: region,
                Key: fullNewPath,
              },
              (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              },
            );
          });
          // 从数据库中删除记录
          await this.prisma.userFile.deleteMany({
            where: {
              filePath: fullNewPath,
              userId: userId,
            },
          });
        }
      }

      // 复制对象到新路径
      await new Promise((resolve, reject) => {
        this.cosClient.putObjectCopy(
          {
            Bucket: bucket,
            Region: region,
            Key: fullNewPath,
            CopySource: `${bucket}.cos.${region}.myqcloud.com/${encodeURIComponent(fullOldPath)}`,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      // 删除原对象
      await new Promise((resolve, reject) => {
        this.cosClient.deleteObject(
          {
            Bucket: bucket,
            Region: region,
            Key: fullOldPath,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });

      // 更新数据库记录
      const updatedRecord = await this.prisma.userFile.updateMany({
        where: {
          filePath: fullOldPath,
          userId: userId,
        },
        data: {
          filePath: fullNewPath,
          fileName: finalNewPath.includes('/')
            ? finalNewPath.substring(finalNewPath.lastIndexOf('/') + 1)
            : finalNewPath,
        },
      });

      return {
        success: true,
        message: '重命名成功',
        updatedCount: updatedRecord.count,
      };
    } catch (error) {
      console.error('重命名用户资源失败:', error);
      throw new BadRequestException(`重命名用户资源失败: ${error.message}`);
    }
  }

  /**
   * 检查对象是否存在
   * @param key 对象键
   * @returns 是否存在
   */
  private async checkObjectExists(key: string): Promise<boolean> {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      await new Promise((resolve, reject) => {
        this.cosClient.headObject(
          {
            Bucket: bucket,
            Region: region,
            Key: key,
          },
          (err, data) => {
            if (err) {
              if (err.statusCode === 404) {
                resolve(false);
              } else {
                reject(err);
              }
            } else {
              resolve(true);
            }
          },
        );
      });
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 删除文件或文件夹
   * @param resourcePath 资源路径
   * @returns 删除结果
   */
  async deleteResource(resourcePath: string) {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 检查资源是否存在
      const exists = await this.checkObjectExists(resourcePath);
      if (!exists) {
        throw new NotFoundException(`资源 ${resourcePath} 不存在`);
      }

      // 如果是文件夹，需要删除所有子对象
      if (resourcePath.endsWith('/')) {
        await this.deleteFolder(resourcePath);
      } else {
        // 删除单个文件
        await new Promise((resolve, reject) => {
          this.cosClient.deleteObject(
            {
              Bucket: bucket,
              Region: region,
              Key: resourcePath,
            },
            (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            },
          );
        });
      }

      return { success: true, message: '资源删除成功' };
    } catch (error) {
      console.error('删除资源失败:', error);
      throw new BadRequestException(`删除资源失败: ${error.message}`);
    }
  }

  /**
   * 删除用户的文件或文件夹
   * @param userId 用户ID
   * @param resourcePath 资源相对路径
   * @returns 删除结果
   */
  async deleteUserResource(userId: number, resourcePath: string) {
    const fullResourcePath = `users/${userId}/${resourcePath}`;

    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    try {
      // 检查资源是否存在且属于该用户
      const exists = await this.checkObjectExists(fullResourcePath);
      if (!exists) {
        throw new NotFoundException(`资源 ${resourcePath} 不存在`);
      }

      // 如果是文件夹，需要删除所有子对象
      if (resourcePath.endsWith('/')) {
        await this.deleteUserFolder(userId, fullResourcePath);
      } else {
        // 删除单个文件
        await new Promise((resolve, reject) => {
          this.cosClient.deleteObject(
            {
              Bucket: bucket,
              Region: region,
              Key: fullResourcePath,
            },
            (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            },
          );
        });

        // 从数据库中删除记录
        await this.prisma.userFile.deleteMany({
          where: {
            filePath: fullResourcePath,
            userId: userId,
          },
        });
      }

      return { success: true, message: '资源删除成功' };
    } catch (error) {
      console.error('删除用户资源失败:', error);
      throw new BadRequestException(`删除用户资源失败: ${error.message}`);
    }
  }

  /**
   * 删除文件夹及其所有内容
   * @param folderPath 文件夹路径
   */
  private async deleteFolder(folderPath: string) {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    // 列出文件夹中的所有对象
    const result = await new Promise<any>((resolve, reject) => {
      this.cosClient.getBucket(
        {
          Bucket: bucket,
          Region: region,
          Prefix: folderPath,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });

    const contents = result.Contents || [];

    if (contents.length === 0) {
      // 如果文件夹为空，直接删除文件夹标记（如果存在）
      try {
        await new Promise((resolve, reject) => {
          this.cosClient.deleteObject(
            {
              Bucket: bucket,
              Region: region,
              Key: folderPath,
            },
            (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            },
          );
        });
      } catch (e) {
        // 忽略删除不存在的文件夹标记的错误
      }
      return;
    }

    // 批量删除所有对象
    const deletePromises = contents.map((item: any) => {
      return new Promise((resolve, reject) => {
        this.cosClient.deleteObject(
          {
            Bucket: bucket,
            Region: region,
            Key: item.Key,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });
    });

    await Promise.all(deletePromises);
  }

  /**
   * 删除用户的文件夹及其所有内容
   * @param userId 用户ID
   * @param folderPath 文件夹路径
   */
  private async deleteUserFolder(userId: number, folderPath: string) {
    const bucket = this.configService.get('TENCENT_COS_BUCKET');
    const region = this.configService.get('TENCENT_COS_REGION');

    // 列出文件夹中的所有对象
    const result = await new Promise<any>((resolve, reject) => {
      this.cosClient.getBucket(
        {
          Bucket: bucket,
          Region: region,
          Prefix: folderPath,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });

    const contents = result.Contents || [];

    if (contents.length === 0) {
      // 如果文件夹为空，直接删除文件夹标记（如果存在）
      try {
        await new Promise((resolve, reject) => {
          this.cosClient.deleteObject(
            {
              Bucket: bucket,
              Region: region,
              Key: folderPath,
            },
            (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            },
          );
        });
      } catch (e) {
        // 忽略删除不存在的文件夹标记的错误
      }
      return;
    }

    // 批量删除所有对象
    const deletePromises = contents.map((item: any) => {
      return new Promise((resolve, reject) => {
        this.cosClient.deleteObject(
          {
            Bucket: bucket,
            Region: region,
            Key: item.Key,
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });
    });

    await Promise.all(deletePromises);

    // 从数据库中删除记录
    await this.prisma.userFile.deleteMany({
      where: {
        filePath: {
          startsWith: folderPath,
        },
        userId: userId,
      },
    });
  }

  /**
   * 获取单个资源的预签名 URL
   * @param nodeId 资源节点ID
   * @param method HTTP请求方法，默认get
   * @param expireTime 签名过期时间（秒），默认3600秒
   * @returns 预签名URL字符串
   */
  /**
   * 获取单个节点的所有预签名 URL
   */
  async getSignedUrl(
    nodeId: number,
    method: 'get' | 'post' | 'put' | 'delete' = 'get',
    expireTime: number = 3600,
  ): Promise<string | string[]> {
    const urls = await this.getMultipleSignedUrls([nodeId], method, expireTime);

    if (urls.length > 0) {
      return urls.length === 1 ? urls[0] : urls;
    }
    throw new Error(`未找到nodeId=${nodeId}对应的资源路径`);
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
}
