import { IsString, MinLength } from 'class-validator';

export class UpdateTypeDto {
  @IsString()
  @MinLength(1)
  type: string;
}
