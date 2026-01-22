import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UpdateUserDto, SafeInfoDto } from './dto/update-user.dto';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  async updateUser(
    userId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UpdateUserDto> {
    // 检查用户是否存在
    const user = this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }

    // 更新用户信息
    return this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
    });
  }

  async updateSafeInfo(
    userId: number,
    safeInfoDto: SafeInfoDto,
  ): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }
    const isHashValid = await bcrypt.compare(
      safeInfoDto.currentPassword,
      user.password,
    );
    const iscurrentPasswordValid =
      safeInfoDto.currentPassword === user.password;
    const isMatch = isHashValid || iscurrentPasswordValid;

    if (!isMatch) {
      throw new HttpException('原密码错误', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(safeInfoDto.newPassword, 10);

    const data: Prisma.UserUpdateInput = {
      password: hashedPassword,
    };

    let emailUpdated = false;

    if (safeInfoDto.email !== undefined && safeInfoDto.email !== user.email) {
      data.email = safeInfoDto.email;
      emailUpdated = true;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    // 只在邮箱变更时返回
    if (emailUpdated) {
      return { email: updatedUser.email };
    }
  }
}
