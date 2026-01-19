import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { plainToInstance, instanceToPlain } from 'class-transformer';

import { PrismaService } from 'prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto, UserDto, RegisterAuthDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(data: LoginAuthDto): Promise<any> {
    const { email, password } = data;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    const isHashValid = await bcrypt.compare(password, user.password);
    const isPlaintextValid = password === user.password;
    const isPasswordValid = isHashValid || isPlaintextValid;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const secretKey = this.configService.get<string>('JWT_SECRET');
    const refreshSecretKey =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!secretKey || !refreshSecretKey) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined');
    }

    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: secretKey, expiresIn: '6h' },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: refreshSecretKey, expiresIn: '7d' },
    );

    // 转换 user 对象，只返回 DTO 定义的字段
    const safeUser = plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: instanceToPlain(safeUser),
    };
  }

  /**
   * 用户注册 + 自动登录
   */
  async register(data: RegisterAuthDto): Promise<any> {
    const { email, password, role } = data;
    // 检查role字段是否合法
    if (role && !['student', 'teacher'].includes(role)) {
      throw new BadRequestException(
        'Role must be either "student" or "teacher"',
      );
    }

    // 1. 检查邮箱是否已注册
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // 2. 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 创建用户，同时只返回安全字段
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        userName: data.userName ? data.userName : '星链',
        role: 'student', // 默认角色
      },
      select: {
        id: true,
        email: true,
        userName: true,
        avatarUrl: true,
        role: true,
      },
    });

    // 4. 生成 JWT token
    const secretKey = this.configService.get<string>('JWT_SECRET');
    const refreshSecretKey =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!secretKey || !refreshSecretKey) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined');
    }

    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: secretKey, expiresIn: '6h' },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      { secret: refreshSecretKey, expiresIn: '7d' },
    );

    // 5. 使用 DTO 保证只返回 @Expose 字段
    const safeUser = plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });

    return {
      message: 'Registration successful',
      accessToken,
      refreshToken,
      user: instanceToPlain(safeUser),
    };
  }
}
