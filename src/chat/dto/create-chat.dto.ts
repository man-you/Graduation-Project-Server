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
  SUMMARY = 'summary',
  GENERATE = 'generate',
}

enum ExerciseType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_BLANK = 'FILL_BLANK',
}

@Exclude()
export class CreateChatDto {
  @Expose()
  @IsOptional()
  @IsNumber()
  conversationId: number;

  @Expose()
  @ValidateIf(
    (u) =>
      u.mode !== 'analysis' && u.mode !== 'summary' && u.mode !== 'generate',
  )
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

  @Expose()
  @ValidateIf((u) => u.mode === 'generate')
  @IsOptional()
  @IsEnum(ExerciseType)
  exerciseType: ExerciseType;

  @Expose()
  @ValidateIf((u) => u.mode === 'generate')
  @IsOptional()
  @IsString()
  userPrompt: string;
}