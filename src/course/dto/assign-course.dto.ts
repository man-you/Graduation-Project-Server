import { Exclude, Expose } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty } from 'class-validator';

@Exclude()
export class AssignCourseDto {
  @Expose()
  @IsNotEmpty()
  @IsInt()
  courseId: number;

  @Expose()
  @IsArray()
  @IsInt({ each: true })
  studentIds: number[];
}
