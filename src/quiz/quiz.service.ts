import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitQuizDto } from './dto/create-quiz.dto';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async getQuiz(nodeId: number): Promise<any> {
    return await this.prisma.exercise.findMany({
      where: {
        nodeId,
      },
      select: {
        id: true,
        exerciseTitle: true,
        exerciseContent: true,
        type: true,
        score: true,
        options: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });
  }

  /**
   * 判断答案是否正确
   */
  async checkAnswer(userId: number, dto: SubmitQuizDto) {
    const { nodeId, answers } = dto;

    // 1. 获取该节点下所有题目的正确答案（包含选项和填空答案）
    const exercises = await this.prisma.exercise.findMany({
      where: { nodeId },
      include: {
        options: {
          where: { isCorrect: true }, // 只查正确选项
          select: { id: true },
        },
      },
    });

    if (exercises.length === 0) {
      throw new BadRequestException('该节点下没有练习题');
    }

    let totalScore = 0;
    const recordsToCreate = []; // 准备批量存入 ExerciseRecord 的数据
    const resultsDetails = []; // 返回给前端的详细结果

    // 2. 遍历题目进行判分
    for (const ex of exercises) {
      // 找到用户提交的对应答案
      const userSub = answers.find((a) => a.exerciseId === ex.id);
      let isCorrect = false;
      let earnedScore = 0;

      if (userSub) {
        if (ex.type === 'SINGLE_CHOICE' || ex.type === 'TRUE_FALSE') {
          // 选择题判断：提交的 ID 是否等于正确选项的 ID
          const correctOption = ex.options[0];
          isCorrect = userSub.selectedOptionId === correctOption?.id;
        } else if (ex.type === 'FILL_BLANK') {
          // 填空题判断：忽略首尾空格和大小写
          isCorrect =
            userSub.blankAnswer?.trim().toLowerCase() ===
            ex.blankAnswer?.trim().toLowerCase();
        }
      }

      if (isCorrect) {
        earnedScore = ex.score;
        totalScore += earnedScore;
      }

      // 3. 构建数据库记录对象
      recordsToCreate.push({
        userId,
        exerciseId: ex.id,
        selectedOptionId: userSub?.selectedOptionId || null,
        blankAnswer: userSub?.blankAnswer || null,
        isCorrect,
        score: earnedScore,
      });

      // 4. 构建返回给前端的明细
      resultsDetails.push({
        exerciseId: ex.id,
        isCorrect,
        score: earnedScore,
        correctAnswer:
          ex.type === 'FILL_BLANK' ? ex.blankAnswer : ex.options[0]?.id,
      });
    }

    // 5. 事务处理：删除旧记录并写入新记录（防止重复提交导致数据冗余）
    await this.prisma.$transaction([
      this.prisma.exerciseRecord.deleteMany({
        where: { userId, exerciseId: { in: exercises.map((e) => e.id) } },
      }),
      this.prisma.exerciseRecord.createMany({
        data: recordsToCreate,
      }),
    ]);

    // 6. 返回结果汇总
    return {
      totalScore,
      fullScore: exercises.reduce((sum, e) => sum + e.score, 0),
      details: resultsDetails,
    };
  }
}
