import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
  Patch,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UpdateUserAdminDto } from './dto/admin-user.dto';
import { RegisterAuthDto } from '../auth/dto/auth.dto';
import { AdminService } from './admin.service';
import { PaginationDto } from '../chat/dto/pagination.dto';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers(@Query() pagination: PaginationDto): Promise<any> {
    return await this.adminService.getAllUsers(
      pagination.pageNum,
      pagination.pageSize,
    );
  }

  @Get('search/users')
  async searchUsers(
    @Query('keyword') keyword: string,
    @Query('pageNum', ParseIntPipe) pageNum: number = 1,
    @Query('pageSize', ParseIntPipe) pageSize: number = 20,
  ): Promise<any> {
    return await this.adminService.searchUserByKeyword(
      keyword,
      pageNum,
      pageSize,
    );
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseIntPipe) userId: number): Promise<any> {
    return await this.adminService.getUserById(userId);
  }

  @Post('user')
  async createUser(@Body() regDto: RegisterAuthDto): Promise<any> {
    return await this.adminService.createUserByAdmin(regDto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id', ParseIntPipe) userId: number): Promise<any> {
    return await this.adminService.deleteUserByAdmin(userId);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateData: UpdateUserAdminDto,
  ): Promise<any> {
    return await this.adminService.updateUserByAdmin(userId, updateData);
  }
}
