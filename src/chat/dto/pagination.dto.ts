import { IsOptional, IsNumber, IsPositive, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Min(1)
  pageNum?: number = 1;

  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  @IsPositive()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}
