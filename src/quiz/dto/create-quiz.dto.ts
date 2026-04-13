import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Exclude, Expose } from 'class-transformer';
import { ExerciseType } from '@prisma/client';

@Exclude()
export class CreateExerciseOptionDto {
  @Expose()
  @IsString()
  content: string;

  @Expose()
  @IsBoolean()
  isCorrect: boolean;
}

@Exclude()
export class CreateExerciseDto {
  @Expose()
  @IsNumber()
  nodeId: number;

  @Expose()
  @IsString()
  exerciseTitle: string;

  @Expose()
  @IsString()
  exerciseContent: string;

  @Expose()
  @IsEnum(ExerciseType)
  type: ExerciseType;

  @Expose()
  @IsNumber()
  score: number;

  @Expose()
  @IsOptional()
  @IsString()
  blankAnswer?: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseOptionDto)
  options?: CreateExerciseOptionDto[];
}

// 单个题目的提交数据
@Exclude()
export class SubmissionItemDto {
  @Expose()
  @IsNumber()
  exerciseId: number;

  @Expose()
  @IsOptional()
  @IsNumber()
  selectedOptionId?: number;

  @Expose()
  @IsOptional()
  @IsString()
  blankAnswer?: string;
}

// 整个练习提交
@Exclude()
export class SubmitQuizDto {
  @Expose()
  @IsNumber()
  nodeId: number;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionItemDto)
  answers: SubmissionItemDto[];
}
