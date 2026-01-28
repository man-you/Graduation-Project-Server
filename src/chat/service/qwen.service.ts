import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
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

  async createStream(
    messages: ChatCompletionMessageParam[],
  ): Promise<AsyncIterable<string>> {
    const stream = await this.openai.chat.completions.create({
      model: 'qwen-plus',
      messages,
      stream: true,
    });

    async function* iterator() {
      for await (const chunk of stream) {
        const content = chunk.choices[0].delta.content;
        if (content) yield content;
      }
    }

    return iterator();
  }
}
