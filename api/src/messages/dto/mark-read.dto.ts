import { IsString, MinLength } from 'class-validator';

export class MarkReadDto {
  @IsString()
  @MinLength(1)
  messageId: string;
}
