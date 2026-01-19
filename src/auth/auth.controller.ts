import { Controller, Post, Body, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../skip-auth/skip-auth.decorator';
import { LoginAuthDto, RegisterAuthDto } from './dto/auth.dto';
import { Response } from 'express';
import { ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UseInterceptors(ClassSerializerInterceptor)
  async login(
    @Body() loginDto: LoginAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const { accessToken, refreshToken, user, message } =
      await this.authService.login(loginDto);
    //设置cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      // secure: true, // 生产环境启用 secure，开发环境不用设置
      // 设置跨站点请求时，是否携带cookie
      // sameSite: 'none',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    });
    return { accessToken, user, message };
  }

  @Public()
  @Post('register')
  async register(@Body() regDto: RegisterAuthDto): Promise<any> {
    return await this.authService.register(regDto);
  }
}
