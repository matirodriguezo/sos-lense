import { IsString, MinLength, IsOptional } from 'class-validator';

export class CloseIncidentDto {
  @IsString()
  @MinLength(1)
  reason: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
