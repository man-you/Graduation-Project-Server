import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitQuizDto, CreateExerciseDto } from './dto/create-quiz.dto';
import { UpdateExerciseDto } from './dto/update-quiz.dto';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取单个练习题
   */
  async getQuestions(exerciseId: number): Promise<any> {
    const exercise = await this.prisma.exercise.findMany({
      where: {
        nodeId: exerciseId,
      },
      select: {
        id: true,
        exerciseTitle: true,
        exerciseContent: true,
        type: true,
        score: true,
        blankAnswer: true,
        options: {
          select: {
            id: true,
            content: true,
            isCorrect: true,
          },
        },
      },
    });

    if (!exercise) {
      throw new HttpException('练习题不存在', 404);
    }

    return exercise;
  }

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
   * 创建练习题
   */
  async createExercise(userId: number, dto: CreateExerciseDto): Promise<any> {
    const {
      nodeId,
      exerciseTitle,
      exerciseContent,
      type,
      score = 10,
      blankAnswer,
      options,
    } = dto;

    // 验证填空题必须有答案
    if (type === 'FILL_BLANK' && !blankAnswer) {
      throw new HttpException('填空题必须提供标准答案', 400);
    }

    // 验证选择题必须有选项
    if (
      (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') &&
      (!options || options.length === 0)
    ) {
      throw new HttpException('选择题必须提供至少一个选项', 400);
    }

    // 对于选择题，确保只有一个正确选项
    if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
      const correctOptions = options.filter((option) => option.isCorrect);
      if (correctOptions.length !== 1) {
        throw new HttpException('选择题必须且只能有一个正确选项', 400);
      }
    }

    // 使用事务确保数据一致性
    return await this.prisma.$transaction(async (tx) => {
      // 创建练习题
      const exercise = await tx.exercise.create({
        data: {
          nodeId,
          exerciseTitle,
          exerciseContent,
          type,
          score,
          blankAnswer: type === 'FILL_BLANK' ? blankAnswer : undefined,
        },
        include: {
          options: true,
        },
      });

      // 如果有选项，批量创建选项
      if (options && options.length > 0) {
        await tx.exerciseOption.createMany({
          data: options.map((option) => ({
            exerciseId: exercise.id,
            content: option.content,
            isCorrect: option.isCorrect || false,
          })),
        });
      }

      return exercise;
    });
  }

  /**
   * 更新练习题
   */
  async updateExercise(
    exerciseId: number,
    dto: UpdateExerciseDto,
  ): Promise<any> {
    const {
      exerciseTitle,
      exerciseContent,
      type,
      score,
      blankAnswer,
      options,
    } = dto;

    // 获取现有练习题信息
    const existingExercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { options: true },
    });

    if (!existingExercise) {
      throw new HttpException('练习题不存在', 404);
    }

    // 如果更新了题型，需要验证数据一致性
    const updatedType = type || existingExercise.type;
    if (updatedType === 'FILL_BLANK') {
      // 填空题不需要选项，如果有选项则删除
      if (options && options.length > 0) {
        throw new HttpException('填空题不能包含选项', 400);
      }
    } else {
      // 选择题类型，验证选项
      if (options) {
        const correctOptions = options.filter((option) => option.isCorrect);
        if (correctOptions.length !== 1) {
          throw new HttpException('选择题必须且只能有一个正确选项', 400);
        }
      }
    }

    // 使用事务确保数据一致性
    return await this.prisma.$transaction(async (tx) => {
      // 更新练习题基本信息
      const updatedExercise = await tx.exercise.update({
        where: { id: exerciseId },
        data: {
          exerciseTitle: exerciseTitle ?? undefined,
          exerciseContent: exerciseContent ?? undefined,
          type: type ?? undefined,
          score: score ?? undefined,
          blankAnswer:
            updatedType === 'FILL_BLANK'
              ? (blankAnswer ?? existingExercise.blankAnswer)
              : undefined,
        },
        include: {
          options: true,
        },
      });

      // 如果提供了选项，更新选项
      if (options) {
        // 删除所有现有选项
        await tx.exerciseOption.deleteMany({
          where: { exerciseId: exerciseId },
        });

        // 创建新选项
        await tx.exerciseOption.createMany({
          data: options.map((option) => ({
            exerciseId: exerciseId,
            content: option.content ?? '',
            isCorrect: option.isCorrect ?? false,
          })),
        });
      }

      return updatedExercise;
    });
  }

  /**
   * 删除练习题
   */
  async deleteExercise(exerciseId: number): Promise<any> {
    // 使用事务确保数据一致性
    return await this.prisma.$transaction(async (tx) => {
      // 检查练习题是否存在
      const existingExercise = await tx.exercise.findUnique({
        where: { id: exerciseId },
      });

      if (!existingExercise) {
        throw new HttpException('练习题不存在', 404);
      }

      // 删除练习题（会级联删除选项和记录）
      await tx.exercise.delete({
        where: { id: exerciseId },
        include: {
          options: true,
        },
      });

      return { success: true, message: '练习题删除成功' };
    });
  }

  /**
   * 判断答案是否正确
   */
  async checkAnswer(userId: number, dto: SubmitQuizDto): Promise<any> {
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
      throw new HttpException('该节点下没有练习题', 404);
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

  /**
   * 获取用户答题记录
   */
  async getUserRecord(userId: number, nodeId: number): Promise<any> {
    // 1. 获取该节点下所有题目的ID
    const exercises = await this.prisma.exercise.findMany({
      where: {
        nodeId: nodeId,
      },
      select: {
        id: true,
      },
    });

    if (exercises.length === 0) {
      return [];
    }

    const exerciseIds = exercises.map((ex) => ex.id);

    // 2. 获取指定用户在这些题目上的所有记录并按时间排序
    const allRecords = await this.prisma.exerciseRecord.findMany({
      where: {
        userId: userId,
        exerciseId: {
          in: exerciseIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 3. 为每个 exerciseId 保留最新的记录
    const latestRecordsMap = new Map();
    for (const record of allRecords) {
      if (!latestRecordsMap.has(record.exerciseId)) {
        latestRecordsMap.set(record.exerciseId, record);
      }
    }

    return Array.from(latestRecordsMap.values());
  }
}
