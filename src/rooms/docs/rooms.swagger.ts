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
import { RoomMessageResponseDto, RoomResponseDto } from './rooms-response.dto';

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
};
