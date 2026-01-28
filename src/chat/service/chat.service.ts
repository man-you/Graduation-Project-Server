import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { QwenService } from './qwen.service';
import { PrismaService } from 'prisma/prisma.service';
import { CreateChatDto } from '../dto/create-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private qwenService: QwenService,
    private prisma: PrismaService,
  ) {}

  // 开启流式对话
  async streamChat(
    dto: CreateChatDto,
    userId: number,
  ): Promise<{ conversationId: number; stream: AsyncIterable<string> }> {
    const { userInput } = dto;
    let conversationId = dto.conversationId;
    /**
     *  开启数据库的事务操作避免数据库操作失败
     */

    await this.prisma.$transaction(async (tx) => {
      // 检查conversationId是否存在合法
      if (conversationId) {
        const conversation = await tx.conversation.findFirst({
          where: { id: conversationId, userId },
          select: { id: true },
        });

        if (!conversation) {
          throw new HttpException('conversation不存在', HttpStatus.OK);
        }
      } else {
        // 创建一个conversation
        const conversation = await tx.conversation.create({
          data: {
            userId,
            title: userInput.slice(0, 10),
          },
        });

        conversationId = conversation.id;
      }

      // 1.保存用户输入消息
      await tx.message.create({
        data: {
          conversationId,
          role: 'user',
          content: userInput,
        },
      });
    });

    // 2.获取对话历史
    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // 3.拼messages
    const messages = history.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    // 4.调用模型
    const stream = await this.qwenService.createStream(messages);
    const prisma = this.prisma;
    const cid = conversationId!;

    // 5. 包一层：边 yield，边收集
    async function* wrapped() {
      let assistantText = '';

      try {
        for await (const chunk of stream) {
          assistantText += chunk;
          yield chunk;
        }
      } finally {
        // 无论 stream 是否正常结束，都尝试落库
        if (assistantText) {
          try {
            await prisma.message.create({
              data: {
                conversationId: cid,
                role: 'assistant',
                content: assistantText,
              },
            });
          } catch (e) {
            console.error('Failed to save assistant message', e);
          }
        }
      }
    }

    return {
      conversationId: cid,
      stream: wrapped(),
    };
  }

  // 加载当前用户所有对话，分页功能
  async loadConversations(
    userId: number,
    pageNum: number = 1,
    pageSize: number = 10,
  ): Promise<any> {
    const skip = (pageNum - 1) * pageSize;
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.conversation.count({
        where: { userId },
      }),
    ]);
    return {
      conversations,
      pagination: {
        pageNum,
        pageSize,
        total,
      },
    };
  }

  // 加载单个对话,拉取消息，分页功能
  async loadConversation(
    userId: number,
    conversationId: number,
    pageNum: number = 1,
    pageSize: number = 20,
  ): Promise<any> {
    if (!conversationId) {
      throw new HttpException('conversationId不存在', HttpStatus.OK);
    }

    // 检查对话
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new HttpException('conversation不存在', HttpStatus.OK);
    }

    // 计算跳过的数量
    const skip = (pageNum - 1) * pageSize;

    // 获取对话消息
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.message.count({
        where: { conversationId },
      }),
    ]);

    // 返回对话消息
    return {
      messages,
      pagination: {
        pageNum,
        pageSize,
        total,
      },
    };
  }

  // 删除对话，需要开启事务保证一致性
  async deleteConversation(
    userId: number,
    conversationId: number,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new HttpException('对话不存在', HttpStatus.NOT_FOUND);
    }

    // 开启事务准备删除
    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: { conversationId },
      });
      await tx.conversation.delete({
        where: { id: conversationId },
      });
    });
  }
}
