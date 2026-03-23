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
  getAllUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getAllUsers(
      pagination.pageNum,
      pagination.pageSize,
    );
  }

  @Get('user/:id')
  getUserById(@Param('id', ParseIntPipe) userId: number) {
    return this.adminService.getUserById(userId);
  }

  @Post('user')
  createUser(@Body() regDto: RegisterAuthDto) {
    return this.adminService.createUserByAdmin(regDto);
  }

  @Delete('user/:id')
  deleteUser(@Param('id', ParseIntPipe) userId: number) {
    return this.adminService.deleteUserByAdmin(userId);
  }

  @Patch('user/:id')
  updateUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateData: UpdateUserAdminDto,
  ) {
    return this.adminService.updateUserByAdmin(userId, updateData);
  }
}
