import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ChatCompletionMessageParam } from 'openai/resources/index';

@Injectable()
export class QwenService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('TONGYI_API_KEY');
    const baseUrl = this.configService.get<string>('TONGYI_CHAT_URL');

    if (!apiKey) {
      throw new Error('OpenAI API Key 未找到，请检查 .env 配置');
    }

    // 配置 通义 SDK
    this.openai = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  async generateStream(
    promptInput: string,
    res: Response,
    systemContext?: string,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    try {
      const messages: ChatCompletionMessageParam[] = [];

      if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
      }

      messages.push({ role: 'user', content: promptInput });

      const stream = await this.openai.chat.completions.create({
        model: 'qwen-plus',
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (closed) break;

        const content = chunk.choices[0].delta.content;
        if (!content) continue;

        res.write(`event: message\ndata: ${content}\n\n`);
      }

      res.write(`event: done\ndata: [DONE]\n\n`);
      res.end();
    } catch (error) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: 'Qwen 调用失败' })}\n\n`,
      );
      res.end();
    }
  }
}
