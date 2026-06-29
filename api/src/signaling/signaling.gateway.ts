import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { IncidentStatus, Role } from '@prisma/client';
import { WsJwtGuard, WsUser } from '../auth/ws-jwt.guard';
import { PrismaService } from '../prisma.service';

// WsJwtGuard is injected and called in handleConnection because
// @UseGuards does NOT apply to the connection event in Nest WS gateways.

interface RoomPeer {
  socketId: string;
  userId: string;
}

@UseGuards(WsJwtGuard)
@WebSocketGateway({ namespace: '/signaling', cors: { origin: '*' } })
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // incidentId -> Set of socketIds
  private rooms = new Map<string, Set<string>>();
  // socketId -> incidentId
  private socketRoom = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGuard: WsJwtGuard,
  ) {}

  handleConnection(client: Socket) {
    try {
      const user = this.wsGuard.verifyClient(client);
      client.data.user = user;
      console.log(`[Signaling] connected ${client.id} user=${user.userId}`);
    } catch (e) {
      console.warn(`[Signaling] auth failed ${client.id}: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.leaveAllRooms(client);
    console.log(`[Signaling] disconnected ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    client: Socket,
    payload: { incidentId: string },
  ): Promise<void> {
    const { incidentId } = payload;
    const user = client.data?.user as WsUser | undefined;
    if (!user) {
      throw new WsException('Unauthorized');
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { citizenId: true, officerId: true },
    });

    if (!incident) {
      throw new WsException('Incident not found');
    }

    const isParticipant =
      incident.citizenId === user.userId ||
      (user.role === Role.OFFICER && incident.officerId === user.userId);

    if (!isParticipant) {
      throw new WsException('Not a participant of this incident');
    }

    const roomName = this.roomName(incidentId);
    client.join(roomName);

    if (!this.rooms.has(incidentId)) {
      this.rooms.set(incidentId, new Set());
    }
    this.rooms.get(incidentId)!.add(client.id);
    this.socketRoom.set(client.id, incidentId);

    console.log(`[Signaling] ${client.id} joined ${roomName}`);
  }

  @SubscribeMessage('signal:offer')
  handleOffer(
    client: Socket,
    payload: { incidentId: string; sdp: unknown },
  ): void {
    this.ensureInRoom(client, payload.incidentId);
    client
      .to(this.roomName(payload.incidentId))
      .emit('signal:offer', { sdp: payload.sdp });
  }

  @SubscribeMessage('signal:answer')
  handleAnswer(
    client: Socket,
    payload: { incidentId: string; sdp: unknown },
  ): void {
    this.ensureInRoom(client, payload.incidentId);
    client
      .to(this.roomName(payload.incidentId))
      .emit('signal:answer', { sdp: payload.sdp });
  }

  @SubscribeMessage('signal:ice')
  handleIce(
    client: Socket,
    payload: { incidentId: string; candidate: unknown },
  ): void {
    this.ensureInRoom(client, payload.incidentId);
    client
      .to(this.roomName(payload.incidentId))
      .emit('signal:ice', { candidate: payload.candidate });
  }

  @SubscribeMessage('signal:bye')
  handleBye(client: Socket, payload: { incidentId: string }): void {
    this.ensureInRoom(client, payload.incidentId);
    client
      .to(this.roomName(payload.incidentId))
      .emit('signal:bye', {});
  }

  @OnEvent('incident.status-changed')
  handleIncidentClosed(payload: {
    incident: { id: string; status: IncidentStatus };
  }) {
    const { incident } = payload;
    if (
      incident.status !== IncidentStatus.CERRADO &&
      incident.status !== IncidentStatus.ANULADO
    ) {
      return;
    }

    const incidentId = incident.id;
    const roomName = this.roomName(incidentId);
    this.server.to(roomName).emit('signal:bye', {});

    const peers = this.rooms.get(incidentId);
    if (peers) {
      peers.forEach((socketId) => {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(roomName);
          this.socketRoom.delete(socketId);
        }
      });
      this.rooms.delete(incidentId);
    }
  }

  private ensureInRoom(client: Socket, incidentId: string) {
    const current = this.socketRoom.get(client.id);
    if (current !== incidentId) {
      throw new WsException('Not joined to this incident room');
    }
  }

  private leaveAllRooms(client: Socket) {
    const incidentId = this.socketRoom.get(client.id);
    if (!incidentId) return;

    const roomName = this.roomName(incidentId);
    client.to(roomName).emit('signal:bye', {});
    client.leave(roomName);

    const peers = this.rooms.get(incidentId);
    if (peers) {
      peers.delete(client.id);
      if (peers.size === 0) {
        this.rooms.delete(incidentId);
      }
    }
    this.socketRoom.delete(client.id);
  }

  private roomName(incidentId: string): string {
    return `incident:${incidentId}`;
  }
}
