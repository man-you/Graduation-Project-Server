import { DynamicModule, Module } from '@nestjs/common';

interface Qwen_Config {
  TONGYI_API_URL: string; // API地址
  TONGYI_API_KEY: string; // API密钥
}

@Module({})
export class QwenConfigModule {
  static register(config: Qwen_Config): DynamicModule {
    return {
      module: QwenConfigModule,
      providers: [
        {
          provide: 'API_CONFIG',
          useValue: config,
        },
      ],
      exports: ['API_CONFIG'],
    };
  }
}
