import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
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

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

@Exclude()
export class UserDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  email: string;

  @Expose()
  @IsString()
  phoneNumber: string;

  @Expose()
  userName: string;

  @Expose()
  @IsString()
  avatarUrl: string;

  @Expose()
  @IsString()
  role: string;

  @Expose()
  @IsString()
  bio: string;

  @Expose()
  @IsString()
  identifier: string;

  @Expose()
  @IsString()
  grade: string;
}
