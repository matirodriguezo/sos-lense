import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { WsJwtGuard, WsUser } from '../auth/ws-jwt.guard';

@UseGuards(WsJwtGuard)
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly wsGuard: WsJwtGuard) {}

  handleConnection(client: Socket) {
    try {
      const user = this.wsGuard.verifyClient(client);
      client.data.user = user;

      const userRoom =
        user.role === Role.OFFICER
          ? `officer:${user.userId}`
          : `citizen:${user.userId}`;
      client.join(userRoom);
      client.join('incidents:active');
      console.log(`[Realtime] connected ${client.id} → ${userRoom}`);
    } catch (e) {
      console.warn(`[Realtime] auth failed ${client.id}: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[Realtime] disconnected ${client.id}`);
  }

  @SubscribeMessage('subscribe:incident')
  handleSubscribeIncident(
    client: Socket,
    payload: { incidentId: string },
  ): void {
    const room = `incident:${payload.incidentId}`;
    client.join(room);
    console.log(`[Realtime] ${client.id} subscribed ${room}`);
  }

  @SubscribeMessage('unsubscribe:incident')
  handleUnsubscribeIncident(
    client: Socket,
    payload: { incidentId: string },
  ): void {
    const room = `incident:${payload.incidentId}`;
    client.leave(room);
    console.log(`[Realtime] ${client.id} unsubscribed ${room}`);
  }

  @OnEvent('incident.created')
  handleIncidentCreated(payload: { incident: { id: string; citizenId: string } }) {
    const { incident } = payload;
    this.server
      .to('incidents:active')
      .to(`citizen:${incident.citizenId}`)
      .emit('incident:created', { incident });
  }

  @OnEvent('incident.updated')
  handleIncidentUpdated(payload: { incident: { id: string; officerId: string | null } }) {
    const { incident } = payload;
    this.server.to(`incident:${incident.id}`).emit('incident:updated', { incident });
    if (incident.officerId) {
      this.server
        .to(`officer:${incident.officerId}`)
        .emit('incident:updated', { incident });
    }
  }

  @OnEvent('incident.status-changed')
  handleIncidentStatusChanged(payload: {
    incident: { id: string; citizenId: string; officerId: string | null };
  }) {
    const { incident } = payload;
    this.server
      .to(`incident:${incident.id}`)
      .to('incidents:active')
      .to(`citizen:${incident.citizenId}`)
      .emit('incident:status-changed', { incident });
    if (incident.officerId) {
      this.server
        .to(`officer:${incident.officerId}`)
        .emit('incident:status-changed', { incident });
    }
  }

  @OnEvent('message.created')
  handleMessageCreated(payload: { incidentId: string; message: unknown }) {
    this.server
      .to(`incident:${payload.incidentId}`)
      .emit('message:created', { incidentId: payload.incidentId, message: payload.message });
  }

  @OnEvent('message.read')
  handleMessageRead(payload: {
    incidentId: string;
    messageId: string;
    readBy: string[];
  }) {
    this.server
      .to(`incident:${payload.incidentId}`)
      .emit('message:read', payload);
  }
}
