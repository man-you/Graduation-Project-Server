import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { UpdateUserAdminDto, UserDto } from './dto/admin-user.dto';
import { RegisterAuthDto } from '../auth/dto/auth.dto';
import { Role } from '@prisma/client';
import { PaginatedUsersDto } from './dto/paginated-users.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 管理员获取所有用户（排除管理员角色），支持分页
   */
  async getAllUsers(
    pageNum: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedUsersDto> {
    const skip = (pageNum - 1) * pageSize;

    const where = { role: { not: 'admin' as Role } };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          userName: true,
          identifier: true,
          role: true,
          phoneNumber: true,
          grade: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const safeUsers = users.map((user) =>
      plainToInstance(UserDto, user, {
        excludeExtraneousValues: true,
      }),
    );

    return plainToInstance(
      PaginatedUsersDto,
      {
        users: safeUsers,
        pageNum,
        pageSize,
        total,
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * 管理员根据ID获取单个用户信息
   */
  async getUserById(userId: number): Promise<{ user: UserDto }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userName: true,
        identifier: true,
        role: true,
        phoneNumber: true,
        grade: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const safeUser = plainToInstance(UserDto, existingUser, {
      excludeExtraneousValues: true,
    });

    return { user: safeUser };
  }

  /**
   * 管理员创建新用户
   */
  async createUserByAdmin(regDto: RegisterAuthDto) {
    const { email, password, userName, role, identifier } = regDto;

    if (role && !['student', 'teacher'].includes(role)) {
      throw new BadRequestException('Role must be either "student", "teacher"');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        identifier,
        userName: userName ? userName : '知链者',
        role: (role || 'student') as Role,
      },
      select: {
        id: true,
        email: true,
        userName: true,
        identifier: true,
        role: true,
        phoneNumber: true,
        grade: true,
      },
    });

    const safeUser = plainToInstance(UserDto, user, {
      excludeExtraneousValues: true,
    });

    return {
      message: 'User created successfully by admin',
      user: safeUser,
    };
  }

  /**
   * 管理员根据ID删除用户
   */
  async deleteUserByAdmin(userId: number): Promise<{ message: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });
    return { message: 'User deleted successfully' };
  }

  /**
   * 管理员根据ID更新用户信息（支持部分字段更新）
   */
  async updateUserByAdmin(userId: number, updateData: UpdateUserAdminDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updatePayload: any = {};

    if (updateData.userName !== undefined) {
      updatePayload.userName = updateData.userName;
    }

    if (updateData.email !== undefined) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (existingEmailUser && existingEmailUser.id !== userId) {
        throw new ConflictException('Email already in use by another user');
      }

      updatePayload.email = updateData.email;
    }

    if (updateData.phoneNumber !== undefined) {
      updatePayload.phoneNumber = updateData.phoneNumber;
    }

    if (updateData.password !== undefined) {
      const hashedPassword = await bcrypt.hash(updateData.password, 10);
      updatePayload.password = hashedPassword;
    }

    if (updateData.role !== undefined) {
      updatePayload.role = updateData.role;
    }

    if (Object.keys(updatePayload).length === 0) {
      const safeUser = plainToInstance(UserDto, existingUser, {
        excludeExtraneousValues: true,
      });
      return {
        message: 'No fields to update',
        user: safeUser,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updatePayload,
      select: {
        id: true,
        email: true,
        userName: true,
        identifier: true,
        role: true,
        phoneNumber: true,
        grade: true,
      },
    });

    const safeUser = plainToInstance(UserDto, updatedUser, {
      excludeExtraneousValues: true,
    });

    return {
      message: 'User updated successfully',
      user: safeUser,
    };
  }
}
