import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { QwenService } from './qwen.service';
@Controller('chat')
export class ChatController {
  constructor(private qwenService: QwenService) {}

  @Post('stream')
  async streamChat(
    @Body() prompt: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.qwenService.generateStream(prompt, res);
  }
}
