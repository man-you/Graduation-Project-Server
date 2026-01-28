import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { Expose, Exclude } from 'class-transformer';
@Exclude()
export class CreateChatDto {
  @Expose()
  @IsOptional()
  @IsNumber()
  conversationId: number;

  @Expose()
  @IsString()
  @IsNotEmpty()
  userInput: string;
}
