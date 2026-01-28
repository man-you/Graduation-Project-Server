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
    @Req() req: any, // 使用 any：SSE 场景下需要监听 req.on('close')
    @Res() res: Response,
  ): Promise<void> {
    /**
     * 1️ 初始化 SSE 响应头
     * - text/event-stream：声明为 SSE
     * - no-cache：防止代理缓存流数据
     * - keep-alive：保持长连接
     */
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 立即发送响应头，避免被中间件缓冲
    res.flushHeaders?.();

    /**
     * 2️ 从 JWT 中获取当前用户 ID
     * - user 信息通常由 Auth Guard 注入到 req 上
     * - SSE 建立后无法再返回 401，只能通过 event:error 通知前端
     */
    const userId = req['user']?.userId;
    if (!userId) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: 'Unauthorized' })}\n\n`,
      );
      res.end();
      return;
    }

    /**
     * 3️ 监听客户端断开连接
     * - 浏览器刷新 / 路由切换 / 网络中断都会触发
     * - 用于及时中断流式写入，避免资源浪费
     */
    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    try {
      /**
       * 4️ 调用 Service 层开始对话
       * - Service 负责 conversation 创建、消息落库、模型调用
       * - 返回 AsyncIterable，用于流式消费
       */
      const { conversationId, stream } = await this.chatService.streamChat(
        body,
        userId,
      );

      /**
       * 5️ 首次下发元信息（非必须，但强烈推荐）
       * - 用于新对话场景，前端可立即绑定 conversationId
       */
      res.write(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`);

      /**
       * 6️ 消费流并逐段推送给前端
       * - 每个 chunk 都是模型生成的一小段文本
       * - 前端可边接收边渲染
       */
      for await (const chunk of stream) {
        if (closed) break;
        res.write(`event: message\ndata: ${JSON.stringify(chunk)}\n\n`);
      }

      /**
       * 7️ 正常结束时发送 done 事件
       * - 前端可据此停止 loading / 标记消息完成
       */
      if (!closed) {
        res.write(`event: done\ndata: [DONE]\n\n`);
      }
    } catch (err) {
      /**
       * 8️ 异常兜底
       * - SSE 过程中无法通过 HTTP 状态码返回错误
       * - 统一通过 event:error 通知前端
       */
      console.error('streamChat error', err);

      if (!res.writableEnded) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: err?.message || 'Chat failed',
          })}\n\n`,
        );
      }
    } finally {
      /**
       * 9️ 确保连接最终关闭
       * - 防止悬挂连接
       * - 即使前面已 close，这里调用也是安全的
       */
      res.end();
    }
  }
  @Get('conversations')
  async getConversations(
    @Query() query: ConversationDto,
    @Req() req: Request,
  ): Promise<any> {
    const userId = req['user']?.userId;

    return await this.chatService.loadConversations(
      userId,
      query.pageNum,
      query.pageSize,
    );
  }

  @Get('conversation')
  async getConversation(
    @Query() query: MessageDto,
    @Req() req: Request,
  ): Promise<any> {
    const userId = req['user']?.userId;

    return await this.chatService.loadConversation(
      userId,
      query.conversationId,
      query.pageNum,
      query.pageSize,
    );
  }

  @Delete('delete/:id')
  async deleteConversation(
    @Param('id', ParseIntPipe) conversationId: number,
    @Req() req: Request,
  ): Promise<void> {
    const userId = req['user']?.userId;

    await this.chatService.deleteConversation(userId, conversationId);
  }
}
