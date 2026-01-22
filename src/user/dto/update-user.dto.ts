import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  Length,
  IsNotEmpty,
  MinLength,
  IsEmail,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  userName?: string;

  @IsOptional()
  @IsPhoneNumber('CN')
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class SafeInfoDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;
}
