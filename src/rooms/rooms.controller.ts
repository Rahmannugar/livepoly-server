import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsLobbyService } from './services/rooms-lobby.service';

@UseGuards(AuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsLobbyService: RoomsLobbyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateRoomDto,
    @Req() request: Request,
  ) {
    return this.roomsLobbyService.createRoom(authUser, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  listLiveRooms(
    @AuthUserDecorator() authUser: AuthUser,
    @Req() request: Request,
  ) {
    return this.roomsLobbyService.listLiveRooms(authUser, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get(':code')
  @HttpCode(HttpStatus.OK)
  getRoomByCode(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
    @Req() request: Request,
  ) {
    return this.roomsLobbyService.getRoomByCode(authUser, code, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  joinRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
    @Req() request: Request,
  ) {
    return this.roomsLobbyService.joinRoom(authUser, code, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post(':code/leave')
  @HttpCode(HttpStatus.OK)
  leaveRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
    @Req() request: Request,
  ) {
    return this.roomsLobbyService.leaveRoom(authUser, code, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
