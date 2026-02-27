import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';

@Module({
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService], // 导出QuizService供其他模块使用
})
export class QuizModule {}