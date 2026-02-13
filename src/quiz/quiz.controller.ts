import { Controller, Get, Param, Post, Body, Req } from '@nestjs/common';
import { SubmitQuizDto } from './dto/create-quiz.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get(':nodeId')
  async findQuiz(@Param('nodeId') nodeId: number) {
    return await this.quizService.getQuiz(nodeId);
  }

  @Post('submit')
  async submitQuiz(@Req() req: Request, @Body() dto: SubmitQuizDto) {
    const userId = req['user']?.userId;
    return await this.quizService.checkAnswer(userId, dto);
  }
}
