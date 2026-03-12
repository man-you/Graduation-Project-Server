import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { SubmitQuizDto } from './dto/create-quiz.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get(':nodeId')
  async findQuiz(@Param('nodeId', ParseIntPipe) nodeId: number) {
    return await this.quizService.getQuiz(nodeId);
  }

  @Post('submit')
  async submitQuiz(@Req() req: Request, @Body() dto: SubmitQuizDto) {
    const userId = req['user']?.userId;
    return await this.quizService.checkAnswer(userId, dto);
  }

  @Get('record/:nodeId')
  async getUserRecord(
    @Req() req: Request,
    @Param('nodeId', ParseIntPipe) nodeId: number,
  ) {
    const userId = req['user']?.userId;
    return await this.quizService.getUserRecord(userId, nodeId);
  }
}
