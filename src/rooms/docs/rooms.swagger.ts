import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRoomDto } from '../dto/create-room.dto';
import { InviteRoomDto } from '../dto/invite-room.dto';
import { StartRoomDto } from '../dto/start-room.dto';
import {
  RoomInviteResponseDto,
  RoomMessageResponseDto,
  RoomResponseDto,
  RoomSpectatorResponseDto,
  StartRoomResponseDto,
} from './rooms-response.dto';

export const RoomsDocs = {
  Controller: () => applyDecorators(ApiTags('Rooms')),

  CreateRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Create room' }),
      ApiBody({
        type: CreateRoomDto,
        examples: {
          oneHourRoom: {
            summary: 'Create one hour room',
            value: { durationMinutes: 60 },
          },
        },
      }),
      ApiCreatedResponse({ type: RoomResponseDto }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Room creation request body failed validation',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'User is already in a waiting or active room',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListLiveRooms: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List live rooms' }),
      ApiOkResponse({ type: [RoomResponseDto] }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  GetCurrentRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Get current room',
        description:
          'Returns the authenticated user current waiting or active room, or null when the user is not in one.',
      }),
      ApiOkResponse({ type: RoomResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  GetRoomByCode: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Get room by code' }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiOkResponse({ type: RoomResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  JoinRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Join room' }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiOkResponse({ type: RoomResponseDto }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Room is full, closed, or user is already in a room',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  LeaveRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Leave room',
        description:
          'If the host leaves a waiting room, the room is cancelled.',
      }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiOkResponse({ type: RoomMessageResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room or room player not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  SpectateRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Spectate active room',
        description:
          'Adds the authenticated user as a spectator for an active room. Players in the room cannot spectate their own room.',
      }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiOkResponse({ type: RoomSpectatorResponseDto }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description:
          'Room is not active, user is already a player, or spectator limit has been reached',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  StopSpectatingRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Stop spectating room' }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiOkResponse({ type: RoomMessageResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room or room spectator not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  InviteToRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Invite friend to room',
        description:
          'Creates a room invite notification for a friend. The invitee joins through the normal join-room endpoint.',
      }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiBody({
        type: InviteRoomDto,
        examples: {
          inviteFriend: {
            summary: 'Invite friend',
            value: { username: 'player_two' },
          },
        },
      }),
      ApiOkResponse({ type: RoomInviteResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Cannot invite yourself',
      }),
      ApiResponse({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        description: 'Room invite request body failed validation',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description:
          'Room is closed, invitee is not a friend, or invitee is already in a room',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room, inviter room player, or invitee not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  StartRoom: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({
        summary: 'Start room',
        description:
          'Starts a waiting room. Three or more human players start ranked with the standard ranked duration. Fewer than three human players are filled with bots and start casual.',
      }),
      ApiParam({ name: 'code', example: 'AbC23xYz' }),
      ApiBody({
        type: StartRoomDto,
        required: false,
        examples: {
          casualBotFill: {
            summary: 'Fill open seats with normal bots',
            value: { botDifficulty: 'normal' },
          },
        },
      }),
      ApiOkResponse({ type: StartRoomResponseDto }),
      ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Only the host can start the room',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Room is not open or could not be started',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Room or host room player not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
