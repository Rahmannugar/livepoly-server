import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFriendRequestDto } from '../dto/create-friend-request.dto';
import {
  FriendRequestsResponseDto,
  FriendshipResponseDto,
  FriendSummaryDto,
} from './friends-response.dto';

export const FriendsDocs = {
  Controller: () => applyDecorators(ApiTags('Friends')),

  SendRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Send friend request' }),
      ApiBody({
        type: CreateFriendRequestDto,
        examples: {
          byUsername: {
            summary: 'Send request by username',
            value: { username: 'friendone' },
          },
        },
      }),
      ApiCreatedResponse({ type: FriendshipResponseDto }),
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Cannot send friend request to yourself',
      }),
      ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Friendship already exists',
      }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListFriends: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List friends' }),
      ApiOkResponse({ type: [FriendSummaryDto] }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  ListRequests: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'List incoming and outgoing friend requests' }),
      ApiOkResponse({ type: FriendRequestsResponseDto }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  AcceptRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Accept friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiOkResponse({ type: FriendshipResponseDto }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  RejectRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Reject friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend request rejected' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  CancelRequest: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Cancel sent friend request' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend request canceled' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friend request not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),

  RemoveFriend: () =>
    applyDecorators(
      ApiBearerAuth('accessToken'),
      ApiOperation({ summary: 'Remove friend' }),
      ApiParam({
        name: 'friendshipId',
        example: '9b4f0ea4-0e76-4dd5-8606-b61dc38b813d',
      }),
      ApiNoContentResponse({ description: 'Friend removed' }),
      ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Friendship not found',
      }),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
      }),
    ),
};
