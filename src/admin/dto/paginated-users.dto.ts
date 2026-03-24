import { AdminUserDto } from './admin-user.dto';
import { Expose } from 'class-transformer';

export class PaginatedUsersDto {
  @Expose()
  users: AdminUserDto[];

  @Expose()
  pageNum: number;

  @Expose()
  pageSize: number;

  @Expose()
  total: number;
}
