import { IsNotEmpty, IsOptional, IsString, IsIn, IsNumber, IsBoolean } from 'class-validator';

export class CreateTencentCoDto {
  @IsNotEmpty()
  @IsString()
  resourceName: string;

  @IsOptional()
  @IsString()
  resourcePath?: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['FILE', 'FOLDER'])
  resourceType: 'FILE' | 'FOLDER';

  @IsOptional()
  @IsString()
  parentPath?: string;

  @IsOptional()
  @IsString()
  fileSize?: string;

  @IsOptional()
  @IsString()
  fileFormat?: string;

  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsBoolean()
  @IsOptional()
  isFolder?: boolean;
}