import { UserDto } from './admin-user.dto';

export class PaginatedUsersDto {
  users: UserDto[];
  pageNum: number;
  pageSize: number;
  total: number;
}