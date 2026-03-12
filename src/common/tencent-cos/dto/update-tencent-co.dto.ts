import { PartialType } from '@nestjs/mapped-types';
import { CreateTencentCoDto } from './create-tencent-co.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTencentCoDto extends PartialType(CreateTencentCoDto) {
  @IsOptional()
  @IsString()
  oldPath?: string;

  @IsOptional()
  @IsString()
  newPath?: string;
}