import { IsOptional, IsString } from 'class-validator';

/**
 * 更新PPT的DTO
 */
export class UpdatePptDto {
  /**
   * PPT标题（可选）
   */
  @IsOptional()
  @IsString()
  title?: string;

  /**
   * PPT描述（可选）
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * PPT URL链接（可选）
   */
  @IsOptional()
  @IsString()
  pptUrl?: string;
}