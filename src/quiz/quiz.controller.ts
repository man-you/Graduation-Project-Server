import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  ParseIntPipe,
  Put,
  Delete,
} from '@nestjs/common';
import { SubmitQuizDto, CreateExerciseDto } from './dto/create-quiz.dto';
import { UpdateExerciseDto } from './dto/update-quiz.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // ===== 练习题管理 =====

  @Post('exercise')
  async createExercise(
    @Req() req: Request,
    @Body() dto: CreateExerciseDto,
  ): Promise<any> {
    const userId = req['user']?.userId;
    return await this.quizService.createExercise(userId, dto);
  }

  @Put('exercise/:exerciseId')
  async updateExercise(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
    @Body() dto: UpdateExerciseDto,
  ): Promise<any> {
    return await this.quizService.updateExercise(exerciseId, dto);
  }

  // 删除练习题
  @Delete('exercise/:exerciseId')
  async deleteExercise(
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
  ): Promise<any> {
    return await this.quizService.deleteExercise(exerciseId);
  }
  @Get('exercises/list/:nodeId')
  async findQuestions(
    @Param('nodeId', ParseIntPipe) nodeId: number,
  ): Promise<any> {
    return await this.quizService.getQuestions(nodeId);
  }

  // ===== 测验功能 =====

  @Get('exercises/:nodeId')
  async findQuiz(@Param('nodeId', ParseIntPipe) nodeId: number): Promise<any> {
    return await this.quizService.getQuiz(nodeId);
  }

  @Post('submit')
  async submitQuiz(
    @Req() req: Request,
    @Body() dto: SubmitQuizDto,
  ): Promise<any> {
    const userId = req['user']?.userId;
    return await this.quizService.checkAnswer(userId, dto);
  }

  @Get('record/:nodeId')
  async getUserRecord(
    @Req() req: Request,
    @Param('nodeId', ParseIntPipe) nodeId: number,
  ): Promise<any> {
    const userId = req['user']?.userId;
    return await this.quizService.getUserRecord(userId, nodeId);
  }
}
