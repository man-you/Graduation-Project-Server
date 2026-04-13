import { Exclude, Expose } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { NodeLevel } from '@prisma/client';

@Exclude()
export class CreateCourseDto {
  @Expose()
  @IsNotEmpty()
  @IsString()
  nodeName: string;

  @Expose()
  @IsEnum(NodeLevel)
  nodeLevel: NodeLevel;

  @Expose()
  @IsOptional()
  @IsString()
  description?: string;

  @Expose()
  @IsOptional()
  @Min(0)
  estimatedDuration?: number;

  @Expose()
  @IsOptional()
  parentNodeId?: number;
}
