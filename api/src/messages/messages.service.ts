import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findByIncident(incidentId: string, userId: string, role: Role) {
    await this.ensureParticipant(incidentId, userId, role);
    return this.prisma.message.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    incidentId: string,
    userId: string,
    role: Role,
    text: string,
  ) {
    await this.ensureParticipant(incidentId, userId, role);

    const message = await this.prisma.message.create({
      data: {
        incidentId,
        senderId: userId,
        senderRole: role,
        text,
        readBy: [userId],
      },
    });

    this.events.emit('message.created', {
      incidentId,
      message,
    });

    return message;
  }

  async markAsRead(
    incidentId: string,
    messageId: string,
    userId: string,
    role: Role,
  ) {
    await this.ensureParticipant(incidentId, userId, role);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.incidentId !== incidentId) {
      throw new NotFoundException('Message not found');
    }

    if (message.readBy.includes(userId)) {
      return message;
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        readBy: { push: userId },
        status: 'read',
      },
    });

    this.events.emit('message.read', {
      incidentId,
      messageId,
      readBy: updated.readBy,
    });

    return updated;
  }

  private async ensureParticipant(
    incidentId: string,
    userId: string,
    role: Role,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { citizenId: true, officerId: true },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const isOwner = incident.citizenId === userId;
    const isOfficer = role === Role.OFFICER && incident.officerId === userId;

    if (!isOwner && !isOfficer) {
      throw new ForbiddenException('Not a participant of this incident');
    }
  }
}
