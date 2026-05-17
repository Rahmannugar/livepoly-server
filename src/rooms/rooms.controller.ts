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
import { RoomsDocs } from './docs/rooms.swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsLobbyService } from './services/rooms-lobby.service';

@RoomsDocs.Controller()
@UseGuards(AuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsLobbyService: RoomsLobbyService) {}

  @RoomsDocs.CreateRoom()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsLobbyService.createRoom(authUser, dto);
  }

  @RoomsDocs.ListLiveRooms()
  @Get()
  @HttpCode(HttpStatus.OK)
  listLiveRooms() {
    return this.roomsLobbyService.listLiveRooms();
  }

  @RoomsDocs.GetRoomByCode()
  @Get(':code')
  @HttpCode(HttpStatus.OK)
  getRoomByCode(@Param('code') code: string) {
    return this.roomsLobbyService.getRoomByCode(code);
  }

  @RoomsDocs.JoinRoom()
  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  joinRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
  ) {
    return this.roomsLobbyService.joinRoom(authUser, code);
  }

  @RoomsDocs.LeaveRoom()
  @Post(':code/leave')
  @HttpCode(HttpStatus.OK)
  leaveRoom(
    @AuthUserDecorator() authUser: AuthUser,
    @Param('code') code: string,
  ) {
    return this.roomsLobbyService.leaveRoom(authUser, code);
  }
}
