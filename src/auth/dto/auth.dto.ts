import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Expose, Exclude } from 'class-transformer';

@Exclude()
export class LoginAuthDto {
  @Expose()
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @Expose()
  @IsNotEmpty()
  @IsString()
  password: string;
}

@Exclude()
export class RegisterAuthDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  password: string;

  @Expose()
  @IsString()
  userName?: string;

  @Expose()
  @IsString()
  role?: string;
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
}
