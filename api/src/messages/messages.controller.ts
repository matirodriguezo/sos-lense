import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('incidents/:incidentId/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  findByIncident(
    @Param('incidentId') incidentId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.findByIncident(
      incidentId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post()
  create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.create(
      incidentId,
      req.user.userId,
      req.user.role,
      dto.text,
    );
  }

  @Post(':messageId/read')
  markAsRead(
    @Param('incidentId') incidentId: string,
    @Param('messageId') messageId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.markAsRead(
      incidentId,
      messageId,
      req.user.userId,
      req.user.role,
    );
  }
}
