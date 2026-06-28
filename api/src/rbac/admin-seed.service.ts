import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_SEED_EMAIL');
    const password = this.config.get<string>('ADMIN_SEED_PASSWORD');
    const rut = this.config.get<string>('ADMIN_SEED_RUT');

    if (!email || !password || !rut) {
      this.logger.warn(
        'ADMIN_SEED_* env vars not fully configured; skipping first officer seed',
      );
      return;
    }

    const officerCount = await this.prisma.user.count({
      where: { role: Role.OFFICER },
    });

    if (officerCount > 0) {
      this.logger.log('Officers already exist; skipping first officer seed');
      return;
    }

    const passwordHash = await argon2.hash(password);
    await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: Role.OFFICER,
        rut,
        alias: 'Administrador',
      },
    });

    this.logger.log('First officer account seeded from environment');
  }
}
