import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentStatus, Role } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma.service';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: jest.Mocked<Pick<PrismaService, 'incident'>>;
  let events: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  beforeEach(() => {
    prisma = {
      incident: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'incident'>>;

    events = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<Pick<EventEmitter2, 'emit'>>;

    service = new IncidentsService(prisma as unknown as PrismaService, events as unknown as EventEmitter2);
  });

  describe('findSince', () => {
    const citizenId = 'citizen-1';
    const officerId = 'officer-1';

    it('returns citizen incidents updated since the given timestamp', async () => {
      const since = '2026-06-28T11:00:00.000Z';
      const incidents = [
        {
          id: 'inc-1',
          citizenId,
          updatedAt: new Date('2026-06-28T12:00:00.000Z'),
        },
      ];
      (prisma.incident.findMany as jest.Mock).mockResolvedValue(incidents);

      const result = await service.findSince(citizenId, Role.CITIZEN, since);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: {
          citizenId,
          updatedAt: { gte: new Date(since) },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(incidents);
    });

    it('returns active and assigned incidents for officers when no since is provided', async () => {
      const incidents = [
        {
          id: 'inc-2',
          officerId,
          updatedAt: new Date('2026-06-28T10:00:00.000Z'),
        },
      ];
      (prisma.incident.findMany as jest.Mock).mockResolvedValue(incidents);

      const result = await service.findSince(officerId, Role.OFFICER);

      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: {
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
            { officerId },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(incidents);
    });

    it('throws BadRequestException for an invalid since value', async () => {
      await expect(
        service.findSince(citizenId, Role.CITIZEN, 'not-a-date'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.incident.findMany).not.toHaveBeenCalled();
    });
  });
});
