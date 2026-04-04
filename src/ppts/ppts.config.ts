import { registerAs } from '@nestjs/config';

/**
 * 讯飞智文API配置
 */
export default registerAs('PPTS', () => ({
  appId: process.env.APPID || '',
  secret: process.env.APISECRET || '',
  baseUrl: 'https://zwapi.xfyun.cn/api/ppt/v2',
}));
