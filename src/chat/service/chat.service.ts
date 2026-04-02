import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { QwenService } from './qwen.service';
import { PrismaService } from 'prisma/prisma.service';
import { CreateChatDto } from '../dto/create-chat.dto';
import { QuizService } from '../../quiz/quiz.service';
import { buildAnalysisPrompt } from '../../prompts/analysis-prompt';
import { buildSummaryPrompt } from '../../prompts/summary-prompt';

@Injectable()
export class ChatService {
  constructor(
    private qwenService: QwenService,
    private prisma: PrismaService,
    private quizService: QuizService,
  ) {}

  async streamChat(
    dto: CreateChatDto,
    userId: number,
  ): Promise<{ conversationId: number; stream: AsyncIterable<string> }> {
    const { userInput, mode, nodeId } = dto;

    if (mode === 'analysis' && nodeId) {
      return this.handleAnalysisMode(nodeId, userId);
    }

    if (mode === 'summary' && nodeId) {
      return this.handleSummaryMode(nodeId);
    }

    if (mode === 'generate' && nodeId) {
      return this.handleGenerateMode(nodeId);
    }

    let conversationId = dto.conversationId;

    await this.prisma.$transaction(async (tx) => {
      if (conversationId) {
        const conversation = await tx.conversation.findFirst({
          where: { id: conversationId, userId },
          select: { id: true },
        });

        if (!conversation) {
          throw new HttpException(
            'Conversation not found',
            HttpStatus.NOT_FOUND,
          );
        }
      } else {
        const conversation = await tx.conversation.create({
          data: {
            userId,
            title: userInput.slice(0, 10),
          },
        });
        conversationId = conversation.id;
      }

      await tx.message.create({
        data: {
          conversationId,
          role: 'user',
          content: userInput,
        },
      });
    });

    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const messages = history.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const stream = await this.qwenService.createStream(messages);
    const prisma = this.prisma;
    const cid = conversationId!;

    async function* wrapped() {
      let assistantText = '';
      try {
        for await (const chunk of stream) {
          assistantText += chunk;
          yield chunk;
        }
      } finally {
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

  async loadConversations(
    userId: number,
    pageNum: number = 1,
    pageSize: number = 10,
  ) {
    const skip = (pageNum - 1) * pageSize;
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);

    return {
      conversations,
      pagination: { pageNum, pageSize, total },
    };
  }

  async loadConversation(
    userId: number,
    conversationId: number,
    pageNum: number = 1,
    pageSize: number = 20,
  ) {
    if (!conversationId) {
      throw new HttpException(
        'Conversation ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    }

    const skip = (pageNum - 1) * pageSize;
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      messages,
      pagination: { pageNum, pageSize, total },
    };
  }

  async deleteConversation(conversationId: number): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { conversationId } });
      await tx.conversation.delete({ where: { id: conversationId } });
    });
  }

  private async handleAnalysisMode(nodeId: number, userId: number) {
    const [quizData, userRecord] = await Promise.all([
      this.quizService.getQuiz(nodeId),
      this.quizService.getUserRecord(userId, nodeId),
    ]);

    const prompt = buildAnalysisPrompt({ nodeId, quizData, userRecord });
    const stream = await this.qwenService.createStream([
      { role: 'user', content: prompt },
    ]);

    return { conversationId: null, stream };
  }

  private async handleSummaryMode(nodeId: number) {
    if (nodeId <= 0) {
      throw new HttpException('Invalid node ID', HttpStatus.BAD_REQUEST);
    }

    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, nodeName: true, description: true },
    });

    if (!node) {
      throw new HttpException(`Node ${nodeId} not found`, HttpStatus.NOT_FOUND);
    }

    const prompt = buildSummaryPrompt({
      nodeId: node.id,
      nodeName: node.nodeName,
      nodeDescription: node.description ?? '',
    });

    const stream = await this.qwenService.createStream([
      { role: 'user', content: prompt },
    ]);
    return { conversationId: null, stream };
  }

  private async handleGenerateMode(nodeId: number) {
    if (nodeId <= 0) {
      throw new HttpException('Invalid node ID', HttpStatus.BAD_REQUEST);
    }

    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, nodeName: true, description: true },
    });

    if (!node) {
      throw new HttpException(`Node ${nodeId} not found`, HttpStatus.NOT_FOUND);
    }

    const prompt = buildSummaryPrompt({
      nodeId: node.id,
      nodeName: node.nodeName,
      nodeDescription: node.description ?? '',
    });

    const stream = await this.qwenService.createStream([
      { role: 'user', content: prompt },
    ]);
    return { conversationId: null, stream };
  }
}
