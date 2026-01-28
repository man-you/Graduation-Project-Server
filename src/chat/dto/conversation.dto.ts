import { PaginationDto } from './pagination.dto';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Expose, Exclude, Transform } from 'class-transformer';
@Exclude()
export class ConversationDto extends PaginationDto {
  @Expose()
  @IsNumber()
  @IsOptional()
  id?: number;

  @Expose()
  @IsString()
  @IsOptional()
  title?: string;
}

export class MessageDto extends PaginationDto {
  @Expose()
  // Query参数类型转换
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @IsOptional()
  conversationId?: number;
}
