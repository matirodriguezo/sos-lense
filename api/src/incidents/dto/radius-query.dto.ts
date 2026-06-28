import { IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RadiusQueryDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  radius?: number = 10000;
}
