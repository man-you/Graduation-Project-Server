import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Expose, Exclude } from 'class-transformer';

/**
 * 创建PPT的DTO
 */
@Exclude()
export class CreatePptDto {
  /**
   * 用户生成PPT要求（最多12000字）
   */
  @Expose()
  @IsString()
  prompt: string;

  /**
   * 模板ID（可选）
   */
  @Expose()
  @IsOptional()
  @IsString()
  templateId?: string;

  /**
   * 业务ID（可选）
   */
  @Expose()
  @IsOptional()
  @IsString()
  businessId?: string;

  /**
   * PPT作者名（可选）
   */
  @Expose()
  @IsOptional()
  @IsString()
  author?: string;

  /**
   * 是否自动配图（可选）
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  isFigure?: boolean;
}

@Exclude()
export class TemplateQueryDto {
  /**
   * 模板风格（可选）
   */
  @IsOptional()
  @IsString()
  style?: string;

  /**
   * 模板颜色（可选）
   */
  @IsOptional()
  @IsString()
  color?: string;

  /**
   * 行业类型（可选）
   */
  @IsOptional()
  @IsString()
  industry?: string;

  /**
   * 页码（可选，默认1）
   */
  @IsOptional()
  @IsNumber()
  pageNum?: number;

  /**
   * 每页数量（可选，默认10）
   */
  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
