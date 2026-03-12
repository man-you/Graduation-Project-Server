import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizModule } from '../quiz/quiz.module';

import { ChatController } from './controller/chat.controller';
import { ChatService } from './service/chat.service';
import { QwenConfigModule } from './qwen.config';
import { QwenService } from './service/qwen.service';

@Module({
  imports: [
    ConfigModule,
    QwenConfigModule.register({
      TONGYI_API_KEY: process.env.TONGYI_API_KEY,
      TONGYI_API_URL: process.env.TONGYI_CHAT_URL,
    }),
    QuizModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, QwenService],
})
export class ChatModule {}