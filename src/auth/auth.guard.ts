import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SKIP_AUTH_KEY } from '../skip-auth/skip-auth.decorator';
// 这个reflactor 叫做反射器，提取上下文中的元数据
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      // 返回当前路由处理方法
      context.getHandler(),
      // 返回当前的控制器
      context.getClass(),
    ]);

    // 从当前的上下文中切换到http请求
    const request = context.switchToHttp().getRequest();
    const token = this.extracToken(request);

    if (isPublic) return true;

    if (!token) {
      //用户未验证
      throw new HttpException('Token is missing', HttpStatus.UNAUTHORIZED);
    }

    try {
      //解构token
      const user = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      request['user'] = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private extracToken(request: Request): string | undefined {
    //解构赋值数组,authorization是请求头的一个参数，用于传递身份验证信息，保护api接口的安全性。
    const [type, token] =
      (request.headers['authorization'] as string)?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
