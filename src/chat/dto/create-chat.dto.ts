import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Expose, Exclude } from 'class-transformer';

enum ChatMode {
  CHAT = 'chat',
  ANALYSIS = 'analysis',
}

@Exclude()
export class CreateChatDto {
  @Expose()
  @IsOptional()
  @IsNumber()
  conversationId: number;

  @Expose()
  @ValidateIf((u) => u.mode !== 'analysis')
  @IsString()
  @IsNotEmpty()
  userInput: string;

  @Expose()
  @IsOptional()
  @IsEnum(ChatMode)
  mode: ChatMode = ChatMode.CHAT;

  @Expose()
  @IsOptional()
  @IsNumber()
  nodeId: number;
}
