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
export class UpdateExerciseOptionDto {
  @Expose()
  @IsOptional()
  @IsNumber()
  id?: number;

  @Expose()
  @IsOptional()
  @IsString()
  content?: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

@Exclude()
export class UpdateExerciseDto {
  @Expose()
  @IsOptional()
  @IsString()
  exerciseTitle?: string;

  @Expose()
  @IsOptional()
  @IsString()
  exerciseContent?: string;

  @Expose()
  @IsOptional()
  @IsEnum(ExerciseType)
  type?: ExerciseType;

  @Expose()
  @IsOptional()
  @IsNumber()
  score?: number;

  @Expose()
  @IsOptional()
  @IsString()
  blankAnswer?: string;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateExerciseOptionDto)
  options?: UpdateExerciseOptionDto[];
}
