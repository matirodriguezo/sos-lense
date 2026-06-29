import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateTypeDto } from './dto/update-type.dto';
import { CloseIncidentDto } from './dto/close-incident.dto';
import { RadiusQueryDto } from './dto/radius-query.dto';
import { SinceQueryDto } from './dto/since-query.dto';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(Role.CITIZEN)
  create(@Body() dto: CreateIncidentDto, @Request() req: RequestWithUser) {
    return this.incidentsService.create(
      req.user.userId,
      dto.citizenAlias || '',
      dto,
    );
  }

  @Get()
  @Roles(Role.CITIZEN, Role.OFFICER)
  findSince(@Query() query: SinceQueryDto, @Request() req: RequestWithUser) {
    return this.incidentsService.findSince(
      req.user.userId,
      req.user.role,
      query.since,
    );
  }

  @Get('active')
  @Roles(Role.OFFICER)
  findActive(@Query() query: RadiusQueryDto) {
    return this.incidentsService.findActiveWithinRadius(
      query.lat,
      query.lng,
      query.radius ?? 10000,
    );
  }

  @Get('mine')
  @Roles(Role.OFFICER)
  findMine(@Request() req: RequestWithUser) {
    return this.incidentsService.findMine(req.user.userId);
  }

  @Get('history')
  @Roles(Role.CITIZEN)
  findHistory(@Request() req: RequestWithUser) {
    return this.incidentsService.findHistory(req.user.userId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.incidentsService.findById(id, req.user.userId, req.user.role);
  }

  @Post(':id/assign')
  @Roles(Role.OFFICER)
  assignOfficer(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.incidentsService.assignOfficer(
      id,
      req.user.userId,
      req.user.email,
    );
  }

  @Post(':id/start')
  @Roles(Role.OFFICER)
  startManaging(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.incidentsService.startManaging(id, req.user.userId);
  }

  @Post(':id/close')
  @Roles(Role.OFFICER)
  closeIncident(
    @Param('id') id: string,
    @Body() dto: CloseIncidentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.incidentsService.closeIncident(
      id,
      req.user.userId,
      dto.reason,
      dto.observations,
    );
  }

  @Post(':id/cancel')
  @Roles(Role.CITIZEN)
  cancelIncident(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: RequestWithUser,
  ) {
    return this.incidentsService.cancelIncident(
      id,
      req.user.userId,
      reason,
    );
  }

  @Post(':id/type')
  updateType(
    @Param('id') id: string,
    @Body() dto: UpdateTypeDto,
    @Request() req: RequestWithUser,
  ) {
    return this.incidentsService.updateType(
      id,
      dto.type,
      req.user.userId,
      req.user.role,
    );
  }
}
