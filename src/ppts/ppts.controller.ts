import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PptsService } from './ppts.service';
import { CreatePptDto, TemplateQueryDto } from './dto/create-ppt.dto';

@Controller('ppts')
export class PptsController {
  constructor(private readonly pptsService: PptsService) {}

  @Post()
  async createPPT(@Body() createPptDto: CreatePptDto): Promise<any> {
    return await this.pptsService.createPPT(createPptDto);
  }

  /**
   * 获取PPT模板列表
   */
  @Post('templates')
  async getTemplateList(
    @Body() templateQueryDto: TemplateQueryDto,
  ): Promise<any> {
    return await this.pptsService.getTemplateList(templateQueryDto);
  }

  /**
   * 查询PPT生成进度
   */
  @Get('progress/:sid')
  async getPptProgress(@Param('sid') sid: string): Promise<any> {
    return await this.pptsService.getPptProgress(sid);
  }
}
