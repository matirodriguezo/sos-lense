import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface RadiusIncident {
  id: string;
  citizenId: string;
  citizenAlias: string;
  officerId: string | null;
  officerAlias: string;
  status: IncidentStatus;
  type: string;
  latitude: number;
  longitude: number;
  address: string;
  quickRequests: string[];
  observations: string;
  closedReason: string;
  cancelled: boolean;
  createdAt: Date;
  updatedAt: Date;
  distance: number;
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    citizenId: string,
    citizenAlias: string,
    dto: {
      latitude: number;
      longitude: number;
      address?: string;
    },
  ) {
    const incident = await this.prisma.incident.create({
      data: {
        citizenId,
        citizenAlias: citizenAlias || '',
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address || '',
        status: IncidentStatus.NO_CLASIFICADO,
      },
    });

    await this.setGeom(incident.id);

    this.events.emit('incident.created', {
      incident,
    });

    return incident;
  }

  private async setGeom(incidentId: string) {
    await this.prisma.$executeRaw`
      UPDATE "incidents"
      SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
      WHERE "id" = ${incidentId}::uuid AND "geom" IS NULL
    `;
  }

  async findActiveWithinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<RadiusIncident[]> {
    return this.prisma.$queryRaw<RadiusIncident[]>`
      SELECT
        "id",
        "citizen_id" AS "citizenId",
        "citizen_alias" AS "citizenAlias",
        "officer_id" AS "officerId",
        "officer_alias" AS "officerAlias",
        "status",
        "type",
        "latitude",
        "longitude",
        "address",
        "quick_requests" AS "quickRequests",
        "observations",
        "closed_reason" AS "closedReason",
        "cancelled",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt",
        ST_Distance(
          "geom",
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS "distance"
      FROM "incidents"
      WHERE "status" IN ('NO_CLASIFICADO', 'ACTIVO', 'EN_CURSO')
        AND "geom" IS NOT NULL
        AND ST_DWithin(
          "geom",
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distance" ASC
    `;
  }

  async findMine(officerId: string) {
    return this.prisma.incident.findMany({
      where: { officerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHistory(citizenId: string) {
    return this.prisma.incident.findMany({
      where: { citizenId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSince(userId: string, role: Role, since?: string) {
    let sinceDate: Date | undefined;
    if (since !== undefined && since !== null && since !== '') {
      sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        throw new BadRequestException('since must be a valid ISO8601 timestamp');
      }
    }

    const baseWhere: Prisma.IncidentWhereInput =
      role === Role.OFFICER
        ? {
            OR: [
              {
                status: {
                  in: [
                    IncidentStatus.NO_CLASIFICADO,
                    IncidentStatus.ACTIVO,
                    IncidentStatus.EN_CURSO,
                  ],
                },
              },
              { officerId: userId },
            ],
          }
        : { citizenId: userId };

    const where: Prisma.IncidentWhereInput = { ...baseWhere };
    if (sinceDate) {
      where.updatedAt = { gte: sinceDate };
    }

    return this.prisma.incident.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(incidentId: string, userId: string, role: Role) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    this.ensureParticipant(incident, userId, role);
    return incident;
  }

  async assignOfficer(
    incidentId: string,
    officerId: string,
    officerAlias: string,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.officerId && incident.officerId !== officerId) {
      throw new ForbiddenException('Incident already assigned');
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        officerId,
        officerAlias: officerAlias || '',
        status: IncidentStatus.ACTIVO,
      },
    });

    this.events.emit('incident.updated', {
      incident: updated,
    });

    return updated;
  }

  async startManaging(incidentId: string, officerId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.officerId !== officerId) {
      throw new ForbiddenException('Not assigned to this incident');
    }
    if (incident.status !== IncidentStatus.ACTIVO) {
      throw new BadRequestException('Incident must be ACTIVO to start');
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.EN_CURSO },
    });

    this.events.emit('incident.status-changed', {
      incident: updated,
    });

    return updated;
  }

  async closeIncident(
    incidentId: string,
    officerId: string,
    reason: string,
    observations?: string,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.officerId !== officerId) {
      throw new ForbiddenException('Not assigned to this incident');
    }
    if (incident.status !== IncidentStatus.EN_CURSO) {
      throw new BadRequestException('Incident must be EN_CURSO to close');
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.CERRADO,
        closedReason: reason,
        observations: observations || incident.observations,
      },
    });

    this.events.emit('incident.status-changed', {
      incident: updated,
    });

    return updated;
  }

  async cancelIncident(incidentId: string, citizenId: string, reason?: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    if (incident.citizenId !== citizenId) {
      throw new ForbiddenException('Not the incident owner');
    }
    if (
      incident.status === IncidentStatus.CERRADO ||
      incident.status === IncidentStatus.ANULADO
    ) {
      throw new BadRequestException('Incident already finalized');
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: IncidentStatus.ANULADO,
        cancelled: true,
        observations: reason || 'Cancelado por el ciudadano',
        closedReason: reason || 'Cancelación voluntaria',
      },
    });

    this.events.emit('incident.status-changed', {
      incident: updated,
    });

    return updated;
  }

  async updateType(
    incidentId: string,
    type: string,
    userId: string,
    role: Role,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    this.ensureParticipant(incident, userId, role);

    const data: { type: string; status?: IncidentStatus } = { type };
    if (incident.status === IncidentStatus.NO_CLASIFICADO) {
      data.status = IncidentStatus.ACTIVO;
    }

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data,
    });

    this.events.emit('incident.updated', {
      incident: updated,
    });

    return updated;
  }

  private ensureParticipant(
    incident: {
      citizenId: string;
      officerId: string | null;
    },
    userId: string,
    role: Role,
  ) {
    const isOwner = incident.citizenId === userId;
    const isOfficer =
      role === Role.OFFICER && incident.officerId === userId;
    if (!isOwner && !isOfficer) {
      throw new ForbiddenException('Not a participant of this incident');
    }
  }
}
