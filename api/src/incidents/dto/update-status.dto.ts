import { IsEnum } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;
}
