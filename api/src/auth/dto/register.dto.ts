import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  rut: string;

  @IsString()
  @IsOptional()
  alias?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
