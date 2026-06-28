import {
  IsNumber,
  IsString,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateIncidentDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  citizenAlias?: string;
}
