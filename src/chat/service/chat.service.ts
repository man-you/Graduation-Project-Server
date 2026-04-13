import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { QwenService } from './qwen.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateChatDto } from '../dto/create-chat.dto';
import { QuizService } from '../../quiz/quiz.service';
import { buildAnalysisPrompt } from '../../prompts/analysis-prompt';
import { buildSummaryPrompt } from '../../prompts/summary-prompt';
import { buildGenerateExercisePrompt } from '../../prompts/generate-exercise-prompt';
import {
  buildChatContextPrompt,
  CHAT_SYSTEM_BASE,
} from '../../prompts/chat-course-prompts';

@Injectable()
export class ChatService {
  constructor(
    private qwenService: QwenService,
    private prisma: PrismaService,
    private quizService: QuizService,
  ) {}

  // ==================== 核心聊天流处理 ====================

  /**
   * 核心聊天流处理
   */
  async streamChat(
    dto: CreateChatDto,
    userId: number,
  ): Promise<{ conversationId: number; stream: AsyncIterable<string> }> {
    const { userInput, mode, nodeId, exerciseType, userPrompt } = dto;

    //  特殊模式快捷处理 (Analysis / Summary / Generate)
    if (mode === 'analysis' && nodeId) {
      return this.handleAnalysisMode(nodeId, userId);
    }
    if (mode === 'summary' && nodeId) {
      return this.handleSummaryMode(nodeId);
    }
    if (mode === 'generate' && nodeId) {
      return this.handleGenerateMode(nodeId, exerciseType, userPrompt);
    }

    //  普通聊天模式 (Chat Mode)
    let conversationId = dto.conversationId;

    // 数据库事务：处理会话创建和用户消息持久化
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
            title: userInput.slice(0, 20),
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

    // 构建 AI 上下文 (注入课程背景)
    let systemPrompt = CHAT_SYSTEM_BASE;
    if (nodeId) {
      const hierarchy = await this.getCourseHierarchy(nodeId);
      if (hierarchy) {
        systemPrompt += buildChatContextPrompt({
          courseName: hierarchy.courseName,
          courseDescription: hierarchy.courseDescription,
          nodeName: hierarchy.nodeName,
          nodeDescription: hierarchy.nodeDescription,
        });
      }
    }

    //  获取最近历史记录
    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10, // 取最近10条保持上下文记忆
    });

    // 组装发送给 AI 的消息队列
    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    //  生成流式响应
    const stream = await this.qwenService.createStream(chatMessages);
    const cid = conversationId!;
    const prisma = this.prisma;

    // 包装流以实现助手回复的自动持久化
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

  // ==================== 特殊模式处理 ====================

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
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, nodeName: true, description: true },
    });
    if (!node) throw new HttpException('Node not found', HttpStatus.NOT_FOUND);

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

  private async handleGenerateMode(
    nodeId: number,
    type: any,
    userPrompt?: string,
  ) {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, nodeName: true, description: true },
    });
    if (!node) throw new HttpException('Node not found', HttpStatus.NOT_FOUND);

    const prompt = buildGenerateExercisePrompt({
      userPrompt: userPrompt || `请基于"${node.nodeName}"知识点生成习题`,
      exerciseType: type || 'SINGLE_CHOICE',
    });

    const stream = await this.qwenService.createStream([
      { role: 'user', content: prompt },
    ]);
    return { conversationId: null, stream };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 私有辅助：轻量级获取课程信息(只获取名称和描述)
   *
   */
  private async getCourseHierarchy(nodeId: number) {
    try {
      // 1. 获取当前节点
      const currentNode = await this.prisma.node.findUnique({
        where: { id: nodeId },
        select: {
          nodeName: true,
          nodeLevel: true,
          parentNodeId: true,
          description: true,
        },
      });

      if (!currentNode) return null;

      // 向上找 LEVEL1 节点 (课程根节点)
      let rootNode = currentNode;
      let depth = 0; // 防止死循环

      while (
        rootNode.nodeLevel !== 'LEVEL1' &&
        rootNode.parentNodeId &&
        depth < 5
      ) {
        const parent = await this.prisma.node.findUnique({
          where: { id: rootNode.parentNodeId },
          select: {
            nodeName: true,
            nodeLevel: true,
            parentNodeId: true,
            description: true,
          },
        });
        if (!parent) break;
        rootNode = parent;
        depth++;
      }

      return {
        courseName: rootNode.nodeName,
        courseDescription: rootNode.description,
        nodeName: currentNode.nodeName,
        nodeDescription: currentNode.description,
      };
    } catch (err) {
      console.error('课程层级获取失败', err);
      return null;
    }
  }

  // ==================== 基础会话管理方法 ====================

  async loadConversations(userId: number, pageNum = 1, pageSize = 10) {
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
    return { conversations, pagination: { pageNum, pageSize, total } };
  }

  async loadConversation(
    userId: number,
    conversationId: number,
    pageNum = 1,
    pageSize = 20,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation)
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);

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
    return { messages, pagination: { pageNum, pageSize, total } };
  }

  async deleteConversation(conversationId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { conversationId } });
      await tx.conversation.delete({ where: { id: conversationId } });
    });
  }
}
