import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    rut: string,
    alias = '',
    requestedRole?: Role,
  ) {
    if (requestedRole === Role.OFFICER) {
      throw new ForbiddenException('Officer self-registration is not allowed');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { rut }] },
    });
    if (existing) {
      throw new ConflictException('Email or RUT already registered');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: Role.CITIZEN,
        rut,
        alias: alias || '',
      },
    });

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = await this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: Role,
  ): Promise<TokenPair> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    const payload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: accessSecret,
      expiresIn: '15m',
    });

    const refreshToken = randomBytes(64).toString('hex');
    const tokenHash = await this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
      },
    });

    return { accessToken, refreshToken };
  }

  private async hashToken(token: string): Promise<string> {
    return argon2.hash(token);
  }
}
