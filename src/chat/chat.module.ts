import { Module } from '@nestjs/common';
import { ChatService } from './service/chat.service';
import { ChatController } from './controller/chat.controller';
import { ConfigModule } from '@nestjs/config';
import { QwenConfigModule } from './qwen.config';
import { QwenService } from './service/qwen.service';

@Module({
  imports: [
    ConfigModule,
    QwenConfigModule.register({
      TONGYI_API_KEY: process.env.TONGYI_API_KEY,
      TONGYI_API_URL: process.env.TONGYI_CHAT_URL,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, QwenService],
})
export class ChatModule {}
