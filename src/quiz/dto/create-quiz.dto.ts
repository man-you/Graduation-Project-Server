import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// 单个题目的提交数据
export class SubmissionItemDto {
  @IsNumber()
  exerciseId: number;

  @IsOptional()
  @IsNumber()
  selectedOptionId?: number; // 单选/判断使用

  @IsOptional()
  @IsString()
  blankAnswer?: string; // 填空题使用
}

// 整个测试提交的载荷
export class SubmitQuizDto {
  @IsNumber()
  nodeId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionItemDto)
  answers: SubmissionItemDto[];
}
