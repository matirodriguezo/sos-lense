import { IsOptional, IsISO8601 } from 'class-validator';

export class SinceQueryDto {
  @IsOptional()
  @IsISO8601()
  since?: string;
}
