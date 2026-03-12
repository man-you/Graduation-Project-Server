import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  Get,
  Query,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CreateChatDto } from '../dto/create-chat.dto';
import { ChatService } from '../service/chat.service';
import { ConversationDto, MessageDto } from '../dto/conversation.dto';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('send')
  async streamChat(
    @Body() body: CreateChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const userId = req['user']?.userId;
    if (!userId) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Unauthorized' })}\n\n`);
      res.end();
      return;
    }

    let closed = false;
    req.on('close', () => { closed = true; });

    try {
      const { conversationId, stream } = await this.chatService.streamChat(body, userId);
      res.write(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`);

      for await (const chunk of stream) {
        if (closed) break;
        res.write(`event: message\ndata: ${JSON.stringify(chunk)}\n\n`);
      }

      if (!closed) {
        res.write(`event: done\ndata: [DONE]\n\n`);
      }
    } catch (err) {
      console.error('streamChat error', err);
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({
          message: err?.message || 'Chat failed',
        })}\n\n`);
      }
    } finally {
      res.end();
    }
  }

  @Get('conversations')
  async getConversations(@Query() query: ConversationDto, @Req() req: Request) {
    const userId = req['user']?.userId;
    return this.chatService.loadConversations(userId, query.pageNum, query.pageSize);
  }

  @Get('conversation')
  async getConversation(@Query() query: MessageDto, @Req() req: Request) {
    const userId = req['user']?.userId;
    return this.chatService.loadConversation(userId, query.conversationId, query.pageNum, query.pageSize);
  }

  @Delete('delete/:id')
  async deleteConversation(@Param('id', ParseIntPipe) conversationId: number): Promise<void> {
    await this.chatService.deleteConversation(conversationId);
  }
}
