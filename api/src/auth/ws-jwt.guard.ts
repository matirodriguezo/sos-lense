import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Socket } from 'socket.io';
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

  /**
   * Verify the JWT from a socket.io client's handshake and return the user.
   * Throws WsException on any failure (missing/invalid/expired token).
   * Shared by canActivate (message guards) and handleConnection (gateways).
   */
  verifyClient(client: Socket): WsUser {
    const token = client.handshake?.auth?.token;

    if (!token || typeof token !== 'string') {
      throw new WsException('Missing authentication token');
    }

    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new WsException('JWT secret not configured');
    }

    const payload = this.jwt.verify<JwtPayload>(token, { secret });
    if (!payload?.sub || !Object.values(Role).includes(payload.role)) {
      throw new WsException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    } as WsUser;
  }

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const user = this.verifyClient(client);
    client.data.user = user;
    return true;
  }
}