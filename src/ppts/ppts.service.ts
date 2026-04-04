import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as FormData from 'form-data'; // 建议使用 form-data 库以保证 Node.js 环境稳定性
import { CreatePptDto } from './dto/create-ppt.dto';
import PPTSConfig from './ppts.config';
import { PPTsAuthUtil } from './ppts.util';

@Injectable()
export class PptsService {
  private readonly logger = new Logger(PptsService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(
    @Inject(PPTSConfig.KEY) private config: ConfigType<typeof PPTSConfig>,
  ) {
    // 初始化 Axios 实例，复用基础配置
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000, // 60秒超时
      maxContentLength: Infinity, // 允许大数据包
      maxBodyLength: Infinity, // 允许大请求体
    });
  }

  /**
   * 获取动态请求头（包含鉴权信息）
   */
  private getHeaders(): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = PPTsAuthUtil.getSignature(
      this.config.appId,
      this.config.secret,
      timestamp,
    );

    return {
      appId: this.config.appId,
      timestamp: timestamp.toString(),
      signature: signature,
    };
  }

  /**
   * 统一异常处理逻辑
   */
  private handleError(error: any, context: string) {
    const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      error.response?.data?.header?.message ||
      error.message ||
      '远程服务调用失败';

    this.logger.error(`${context} 失败: ${message}`, error.stack);
    throw new HttpException(message, status);
  }

  /**
   * PPT主题模板列表查询
   */
  async getTemplateList(params: {
    style?: string;
    color?: string;
    industry?: string;
    pageNum?: number;
    pageSize?: number;
  }) {
    try {
      const response = await this.axiosInstance.post('/template/list', params, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      this.handleError(error, '获取模板列表');
    }
  }

  /**
   * 创建PPT（直接根据用户输入要求生成）
   */
  async createPPT(createPptDto: CreatePptDto) {
    const { prompt, templateId, author, isFigure } = createPptDto;

    if (!prompt?.trim()) {
      throw new HttpException(
        '请求内容（prompt）不能为空',
        HttpStatus.BAD_REQUEST,
      );
    }

    const formData = new FormData();
    formData.append('query', prompt.trim());
    formData.append('templateId', templateId || '');
    formData.append('author', author || '');
    formData.append('isFigure', String(!!isFigure));

    try {
      const headers = this.getHeaders();

      const response = await this.axiosInstance.post('/create', formData, {
        headers: {
          ...headers,
          ...formData.getHeaders(),
        },
      });

      const sid = response.data.data.sid;

      if (!sid) {
        throw new Error('未获取到会话ID');
      }

      return { sid };
    } catch (error) {
      this.handleError(error, '创建PPT任务');
    }
  }

  /**
   * 查询PPT生成进度
   * @param sid 请求唯一ID（从 createPPT 返回）
   */
  async getPptProgress(sid: string) {
    if (!sid) {
      throw new HttpException('sid 不能为空', HttpStatus.BAD_REQUEST);
    }

    try {
      // 注意：此处如果接口地址不在 baseUrl 下，建议统一使用相对路径或更新 baseUrl
      const response = await this.axiosInstance.get('/progress', {
        params: { sid },
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      this.handleError(error, '查询PPT进度');
    }
  }
}
