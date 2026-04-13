import { IsEmail, IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { Expose, Exclude } from 'class-transformer';

@Exclude()
export class UpdateUserAdminDto {
  @Expose()
  @IsString()
  @IsOptional()
  userName?: string;

  @Expose()
  @IsEmail()
  @IsOptional()
  email?: string;

  @Expose()
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @Expose()
  @IsString()
  @IsOptional()
  password?: string;

  @Expose()
  @IsString()
  @IsOptional()
  @IsIn(['student', 'teacher', 'admin'])
  role?: string;
}

@Exclude()
export class AdminUserDto {
  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsOptional()
  @IsString()
  email: string;

  @Expose()
  @IsOptional()
  @IsString()
  phoneNumber: string;

  @Expose()
  @IsOptional()
  userName: string;

  @Expose()
  @IsString()
  @IsOptional()
  avatarUrl: string;

  @Expose()
  @IsString()
  @IsOptional()
  role: string;

  @Expose()
  @IsString()
  @IsOptional()
  identifier: string;

  @Expose()
  @IsString()
  @IsOptional()
  grade: string;

  @Expose()
  @IsOptional()
  @IsString()
  department: string;

  @Expose()
  @IsOptional()
  @IsString()
  realName: string;
}
