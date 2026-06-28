import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { JwtPayload } from './auth.service';

export interface WsUser {
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token;

    if (!token || typeof token !== 'string') {
      throw new WsException('Missing authentication token');
    }

    try {
      const secret = this.config.get<string>('JWT_ACCESS_SECRET');
      if (!secret) {
        throw new WsException('JWT secret not configured');
      }
      const payload = this.jwt.verify<JwtPayload>(token, { secret });
      if (!payload?.sub || !Object.values(Role).includes(payload.role)) {
        throw new WsException('Invalid token payload');
      }
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      } as WsUser;
      return true;
    } catch {
      throw new WsException('Invalid or expired token');
    }
  }
}
