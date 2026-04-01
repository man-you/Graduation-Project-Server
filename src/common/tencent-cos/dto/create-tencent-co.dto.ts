import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
} from 'class-validator';

export class CreateTencentCoDto {
  @IsNotEmpty({ message: '资源名称不能为空' })
  @IsString()
  resourceName: string;

  @IsNotEmpty({ message: '资源类型必须指定' })
  @IsString()
  @IsIn(['FILE', 'FOLDER'])
  resourceType: 'FILE' | 'FOLDER';

  @IsOptional()
  @IsString()
  parentPath?: string;

  @IsOptional()
  @IsString()
  fileSize?: string;

  @IsOptional()
  @IsString()
  fileFormat?: string;

  // 内部使用，不暴露给前端输入，但在逻辑中通过装饰器赋值
  @IsNumber()
  @IsOptional()
  userId?: number;
}

// 用于教学资源上传的 DTO，匹配前端 BindResourceDto 接口
export class BindResourceDto {
  @IsNotEmpty({ message: '资源名称不能为空' })
  @IsString()
  resourceName: string;

  @IsNotEmpty({ message: '资源类型必须指定' })
  @IsString()
  @IsIn(['PPT', 'VIDEO', 'PDF'])
  resourceType: 'PPT' | 'VIDEO' | 'PDF';

  @IsOptional()
  @IsString()
  parentPath?: string;

  @IsOptional()
  @IsString()
  fileSize?: string;

  @IsOptional()
  @IsString()
  fileFormat?: string;

  @IsNotEmpty({ message: '知识节点ID不能为空' })
  @IsNumber()
  nodeId: number;
}
