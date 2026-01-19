//自定义装饰器，用于跳过权限验证。
import { SetMetadata } from '@nestjs/common';

export const SKIP_AUTH_KEY = 'SKIP_AUTH_KEY';
export const Public = () => SetMetadata(SKIP_AUTH_KEY, true);
