import { Controller, Body, Patch, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto, SafeInfoDto } from './dto/update-user.dto';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';

@UseGuards()
@Controller('user')
@ApiTags('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('info')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ): Promise<UpdateUserDto> {
    // 从请求头中获取用户id
    const userId = req['user'].userId;
    return await this.userService.updateUser(+userId, updateUserDto);
  }

  @Patch('pass')
  async updateSafeInfo(
    @Body() safeInfoDto: SafeInfoDto,
    @Req() req: Request,
  ): Promise<{ email: string }> {
    // 从请求头中获取用户id
    const userId = req['user'].userId;
    return await this.userService.updateSafeInfo(+userId, safeInfoDto);
  }
}
