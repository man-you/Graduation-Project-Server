import { PartialType } from '@nestjs/mapped-types';
import { CreateTencentCoDto } from './create-tencent-co.dto';

export class UpdateTencentCoDto extends PartialType(CreateTencentCoDto) {}
