import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser as AuthUserDecorator } from '../auth/decorators/auth-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RoomsDocs } from './docs/rooms.swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { InviteRoomDto } from './dto/invite-room.dto';
import { ROOMS_RATE_LIMIT_RULES } from './rooms-rate-limit.rules';
import { RoomsGameService } from './services/rooms-game.service';
import { RoomsLobbyService } from './services/rooms-lobby.service';

@RoomsDocs.Controller()
@UseGuards(AuthGuard, RateLimitGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsLobbyService: RoomsLobbyService,
    private readonly roomsGameService: RoomsGameService,
  ) {}

  @RoomsDocs.CreateRoom()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.mutation)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsLobbyService.createRoom(authUser, dto);
  }

  @RoomsDocs.ListLiveRooms()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.read)
  @Get()
  @HttpCode(HttpStatus.OK)
  listLiveRooms() {
    return this.roomsLobbyService.listLiveRooms();
  }

  @RoomsDocs.GetRoomByCode()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.read)
  @Get(':code')
  @HttpCode(HttpStatus.OK)
  getRoomByCode(@Param('code') code: string) {
    return this.roomsLobbyService.getRoomByCode(code);
  }

  @RoomsDocs.JoinRoom()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.mutation)
  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  joinRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
  ) {
    return this.roomsLobbyService.joinRoom(authUser, code);
  }

  @RoomsDocs.LeaveRoom()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.mutation)
  @Post(':code/leave')
  @HttpCode(HttpStatus.OK)
  leaveRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
  ) {
    return this.roomsLobbyService.leaveRoom(authUser, code);
  }

  @RoomsDocs.InviteToRoom()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.mutation)
  @Post(':code/invites')
  @HttpCode(HttpStatus.OK)
  inviteToRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
    @Body() dto: InviteRoomDto,
  ) {
    return this.roomsLobbyService.inviteToRoom(authUser, code, dto);
  }

  @RoomsDocs.StartRoom()
  @RateLimit(...ROOMS_RATE_LIMIT_RULES.start)
  @Post(':code/start')
  @HttpCode(HttpStatus.OK)
  startRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
  ) {
    return this.roomsGameService.startRoom(authUser, code);
  }
}
